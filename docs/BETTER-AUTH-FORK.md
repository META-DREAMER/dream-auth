# The Better Auth fork, and `patches/`

## Why the patch exists

The SIWE plugin that ships with `better-auth` cannot link a wallet to an
existing account. The fix lives in our fork,
[`github.com/META-DREAMER/better-auth`](https://github.com/META-DREAMER/better-auth),
which adds wallet-account-linking to the SIWE plugin. It was offered upstream as
[better-auth/better-auth#7564](https://github.com/better-auth/better-auth/pull/7564)
and is **still open**, so until it merges we carry the change ourselves.

## The fork is not a dependency

`package.json` installs `better-auth` from npm like any other package. The fork
is never resolved, fetched or built at install time. The change reaches the
installed package as a **pnpm patch**:

```json
"pnpm": {
  "patchedDependencies": {
    "better-auth@1.7.5": "patches/better-auth@1.7.5.patch"
  }
}
```

Keeping it this way means `pnpm install` stays reproducible and offline-able,
the diff is reviewable in the repo, and dropping the fork later is a one-line
change plus a file deletion.

## What belongs in the patch

Exactly two paths:

```
dist/plugins/siwe/index.mjs
dist/plugins/siwe/index.d.mts
```

Nothing else. A full `dist` diff between two builds is mostly build
nondeterminism - hashes, chunk names, reordered exports, banner timestamps - and
including any of it makes the patch fail to apply on the next upgrade for no
reason. If a third file looks necessary, that is a signal the fork's change grew
beyond the SIWE plugin and should be re-scoped, not that the patch should grow.

## Regenerating it

1. **Rebase the fork** onto the upstream tag you are moving to, and build it:

   ```sh
   git -C ../better-auth fetch upstream
   git -C ../better-auth rebase v<version>
   pnpm -C ../better-auth install && pnpm -C ../better-auth --filter better-auth build
   ```

2. **Extract the pristine npm tarball** to diff against:

   ```sh
   mkdir -p /tmp/ba && cd /tmp/ba
   npm pack better-auth@<version>
   tar xzf better-auth-<version>.tgz   # unpacks to ./package
   ```

3. **Diff only the two paths**, from the extraction root so the patch headers
   read `a/dist/...` / `b/dist/...`:

   ```sh
   cd /tmp/ba/package
   for f in dist/plugins/siwe/index.mjs dist/plugins/siwe/index.d.mts; do
     git diff --no-index -- "$f" "../../better-auth/packages/better-auth/$f"
   done > /path/to/dream-auth/patches/better-auth@<version>.patch
   ```

   Fix up the `b/` paths in the result so both sides are `dist/plugins/siwe/...`;
   pnpm applies the patch against the package root.

4. **Repoint and verify**:

   ```sh
   # package.json: pnpm.patchedDependencies -> "better-auth@<version>": "patches/better-auth@<version>.patch"
   pnpm install          # fails loudly if the patch does not apply cleanly
   pnpm typecheck && pnpm test
   ```

5. Delete the old patch file. One version, one patch.

## Upgrading

Rebase fork → rebuild → re-diff → repoint `pnpm.patchedDependencies` → delete
the old patch. A clean `pnpm install` is the gate: pnpm refuses a patch that
does not apply, so a silently-dropped fix is not a failure mode here.

When [#7564](https://github.com/better-auth/better-auth/pull/7564) merges, drop
`patches/` and the `patchedDependencies` block entirely and pin the first
release that contains it.
