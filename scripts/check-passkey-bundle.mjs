#!/usr/bin/env node
/**
 * Passkey regression check against the BUILT server output.
 *
 * Why this runs on `.output` and not on the source: the bug it guards
 * against lives in dependency resolution, not in our code. `@peculiar/
 * asn1-schema` registers ASN.1 schemas through class decorators into a
 * module-level `schemaStorage` singleton. If two copies of asn1-schema are
 * installed, `@peculiar/asn1-ecc` decorates `ECDSASigValue` into one copy's
 * storage while `@simplewebauthn/server` parses with the other copy's
 * `AsnParser`, and every ES256 assertion fails with
 * "Cannot get schema for 'ECDSASigValue' target". A vitest on the source
 * can pass while the deployed bundle is broken, so this check:
 *
 *   1. counts `new AsnSchemaStorage*(` across the server bundle (must be 1),
 *   2. imports the built @simplewebauthn/server chunk and verifies a real
 *      ES256 WebAuthn assertion generated with node:crypto,
 *   3. verifies a `none`-attestation registration the same way.
 *
 * The single-copy invariant is enforced by the `@peculiar/asn1-schema`
 * entry in `pnpm.overrides` (package.json). Run: `pnpm build` (chained), or
 * `node --import=reflect-metadata scripts/check-passkey-bundle.mjs` after
 * a build. `reflect-metadata` is needed because the chunk graph pulls in
 * tsyringe, exactly as the production start command does.
 */
import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const serverDir = resolve(process.argv[2] ?? ".output/server");
const chunk = join(serverDir, "_chunks/_libs/@simplewebauthn/server.mjs");

function fail(msg) {
	console.error(`check-passkey-bundle: FAIL ${msg}`);
	process.exit(1);
}

// 1. One schema storage singleton in the whole server bundle.
function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) yield* walk(p);
		else if (p.endsWith(".mjs")) yield p;
	}
}
const storageSites = [];
for (const file of walk(serverDir)) {
	// Rollup suffixes duplicate class names (AsnSchemaStorage$1, AsnSchemaStorage2).
	const n = (readFileSync(file, "utf8").match(/new AsnSchemaStorage[\w$]*\(/g) ?? []).length;
	if (n > 0) storageSites.push(`${file}: ${n}`);
}
const storageCount = storageSites.reduce(
	(sum, line) => sum + Number(line.split(": ").pop()),
	0,
);
if (storageCount !== 1) {
	fail(
		`expected exactly 1 AsnSchemaStorage instance in the server bundle, found ${storageCount}:\n  ${storageSites.join("\n  ")}\n` +
			"Two copies of @peculiar/asn1-schema are bundled; check `pnpm why @peculiar/asn1-schema` and the pnpm override.",
	);
}

// 2. Resolve the mangled exports of the built chunk by their local names.
const source = readFileSync(chunk, "utf8");
function exportedAs(localName) {
	const m = source.match(new RegExp(`\\b${localName} as (\\w+)`));
	if (!m) fail(`could not find export '${localName}' in ${chunk}`);
	return m[1];
}
const mod = await import(pathToFileURL(chunk).href);
const verifyAuthenticationResponse = mod[exportedAs("verifyAuthenticationResponse")];
const verifyRegistrationResponse = mod[exportedAs("verifyRegistrationResponse")];

// 3. Synthetic ES256 credential + assertion.
const b64u = (b) => Buffer.from(b).toString("base64url");
const sha256 = (b) => createHash("sha256").update(b).digest();

const rpID = "localhost";
const origin = "http://localhost:3000";
const { privateKey, publicKey } = generateKeyPairSync("ec", {
	namedCurve: "P-256",
});
const jwk = publicKey.export({ format: "jwk" });
const x = Buffer.from(jwk.x, "base64url");
const y = Buffer.from(jwk.y, "base64url");
// COSE_Key EC2/P-256/ES256: {1:2, 3:-7, -1:1, -2:x, -3:y}
const cosePublicKey = Buffer.concat([
	Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
	x,
	Buffer.from([0x22, 0x58, 0x20]),
	y,
]);
const credentialIdBytes = Buffer.from("passkey-bundle-check");
const credentialID = b64u(credentialIdBytes);
const rpIdHash = sha256(rpID);

// Registration: attested credential data with fmt "none" (what the
// better-auth passkey plugin requests), CBOR-encoded by hand.
const aaguid = Buffer.alloc(16);
const attestedCredentialData = Buffer.concat([
	aaguid,
	Buffer.from([0, credentialIdBytes.length]),
	credentialIdBytes,
	cosePublicKey,
]);
const regAuthData = Buffer.concat([
	rpIdHash,
	Buffer.from([0x45]), // UP | UV | AT
	Buffer.from([0, 0, 0, 0]),
	attestedCredentialData,
]);
const cborText = (s) => Buffer.concat([Buffer.from([0x60 + s.length]), Buffer.from(s)]);
const cborBytes = (b) => Buffer.concat([Buffer.from([0x58, b.length]), b]);
const attestationObject = Buffer.concat([
	Buffer.from([0xa3]),
	cborText("fmt"),
	cborText("none"),
	cborText("attStmt"),
	Buffer.from([0xa0]),
	cborText("authData"),
	cborBytes(regAuthData),
]);
const regChallenge = b64u("registration-challenge");
const regClientDataJSON = Buffer.from(
	JSON.stringify({ type: "webauthn.create", challenge: regChallenge, origin }),
);
const registration = await verifyRegistrationResponse({
	response: {
		id: credentialID,
		rawId: credentialID,
		type: "public-key",
		clientExtensionResults: {},
		response: {
			attestationObject: b64u(attestationObject),
			clientDataJSON: b64u(regClientDataJSON),
		},
	},
	expectedChallenge: regChallenge,
	expectedOrigin: origin,
	expectedRPID: rpID,
	requireUserVerification: true,
});
if (!registration.verified) fail("registration (fmt=none) did not verify");

// Authentication: DER ECDSA signature over authData || sha256(clientDataJSON).
const authChallenge = b64u("authentication-challenge");
const authData = Buffer.concat([
	rpIdHash,
	Buffer.from([0x05]), // UP | UV
	Buffer.from([0, 0, 0, 1]),
]);
const clientDataJSON = Buffer.from(
	JSON.stringify({ type: "webauthn.get", challenge: authChallenge, origin }),
);
const signature = createSign("SHA256")
	.update(Buffer.concat([authData, sha256(clientDataJSON)]))
	.sign(privateKey);

let authentication;
try {
	authentication = await verifyAuthenticationResponse({
		response: {
			id: credentialID,
			rawId: credentialID,
			type: "public-key",
			clientExtensionResults: {},
			response: {
				authenticatorData: b64u(authData),
				clientDataJSON: b64u(clientDataJSON),
				signature: b64u(signature),
			},
		},
		expectedChallenge: authChallenge,
		expectedOrigin: origin,
		expectedRPID: rpID,
		credential: {
			id: credentialID,
			publicKey: new Uint8Array(cosePublicKey),
			counter: 0,
		},
		requireUserVerification: true,
	});
} catch (err) {
	fail(`ES256 assertion threw in the built bundle: ${err?.stack ?? err}`);
}
if (!authentication.verified) fail("ES256 assertion did not verify");

console.log(
	`check-passkey-bundle: OK (1 AsnSchemaStorage, registration + ES256 assertion verified via ${chunk})`,
);
