# Web3 / SIWE Integration

Sign-In With Ethereum (SIWE) allows users to authenticate with Ethereum wallets. Uses Wagmi for wallet management, Viem for message signing/verification, and a custom SimpleKit UI.

**Feature flag:** `ENABLE_SIWE` (default: `true`)

## Wagmi Configuration

**Location:** `src/lib/wagmi.ts`

- **Chain:** Ethereum mainnet only
- **Connectors:** `injected()`, `porto()`, `safe()`, `baseAccount()`, `walletConnect()` (optional)
- **Transport:** HTTP RPC to mainnet

WalletConnect requires `VITE_WALLETCONNECT_PROJECT_ID` to be set.

## Provider Setup

**Location:** `src/components/web3-provider.tsx`

```tsx
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <SimpleKitProvider>
      {children}
    </SimpleKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

Wraps the app in `__root.tsx`. React Query configured with 1-minute stale time and single retry.

## SimpleKit (Wallet UI)

**Location:** `src/components/simplekit/`

Custom lightweight wallet connection UI replacing RainbowKit/ConnectKit. Full control over UX with minimal dependencies.

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `SimpleKitProvider` | `simplekit-provider.tsx` | Modal state, Wagmi/RQ providers |
| `useSimpleKit` | `use-simple-kit.ts` | `open()`, `close()`, `isConnected`, `formattedAddress` |
| `Connectors` | `components/connectors.tsx` | Wallet list or connecting state |
| `WalletOptions` | `components/wallet-options.tsx` | Filtered/sorted wallet list |
| `Account` | `components/account.tsx` | Connected account: ENS, balance, disconnect |
| `SimpleKitModal` | `simplekit-modal.tsx` | Dialog (desktop) / Drawer (mobile) |

**Modal close delay:** 320ms (`MODAL_CLOSE_DURATION`) allows close animation before clearing state.

## SIWE Authentication Flow

**Hook:** `src/hooks/use-siwe-auth.ts`

```
1. Get Nonce     → siwe.nonce({ walletAddress, chainId })
2. Create Message → viem/siwe.createSiweMessage({ domain, address, nonce, ... })
3. Sign Message  → wallet.signMessageAsync({ message })
4. Verify        → siwe.verify({ message, signature, walletAddress, chainId })
```

Uses `viem/siwe.createSiweMessage()` — not the `siwe` package constructor (avoids v3 bugs).

### useSiweAuth Hook

```ts
const { authenticate, isAuthenticating, error, clearError } = useSiweAuth({
  onSuccess: () => navigate({ to: "/" }),
  onError: (err) => console.error(err),
  disconnectOnError: true, // default
});
```

### Auto-Trigger

**Hook:** `src/hooks/use-siwe-auto-trigger.ts`

Automatically triggers SIWE signing after wallet connection to reduce friction. Tracks per-address to prevent infinite loops. Used by `ConnectSIWEButton` and `LinkWalletDialog`.

## BetterAuth SIWE Plugin

**Location:** `src/lib/auth.ts`

Server-side configuration:

- **Nonce:** Generated via `generateSiweNonce()` from `viem/siwe`
- **Verification:** `verifyMessage()` from `viem`
- **ENS Lookup:** Optional name/avatar resolution via `createPublicClient()` on mainnet
- **Domain:** Extracted from `BETTER_AUTH_URL` hostname

Client-side: `siweClient()` plugin in `src/lib/auth-client.ts` exposes `siwe.nonce()` and `siwe.verify()`.

## Account Linking

**Configuration:** `src/lib/auth.ts`

```ts
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: ["siwe", "email-password", "email-otp"],
    allowDifferentEmails: true,
  },
}
```

Users can link multiple wallets to one account. SIWE accounts stored as:
- `providerId`: `"siwe"`
- `accountId`: `"{walletAddress}:{chainId}"` (lowercase)

### Link Wallet Dialog

**Location:** `src/components/auth/link-wallet-dialog.tsx`

Flow: Start linking → open wallet modal → connect → auto-sign SIWE → link account → disconnect (ready for next wallet).

### Wallet List

**Location:** `src/components/auth/wallet-list.tsx`

Displays linked SIWE accounts. Supports unlinking via `authClient.unlinkAccount({ providerId: "siwe", accountId })`.

## Wallet Invitations

**Location:** `src/lib/invite-helpers.ts`

Organizations can invite members by wallet address:

```ts
inviteByWallet(walletAddress, role, organizationId)
```

- Generates deterministic email: `{walletAddress}@{auth-domain}`
- Stores `walletAddress` on the invitation record
- Server validates wallet ownership in `beforeAcceptInvitation` hook (checks SIWE account matches invited address)

See [ORGANIZATION.md](./ORGANIZATION.md) for the full invitation system.

## ENS Integration

| Location | Purpose |
|----------|---------|
| `src/lib/auth.ts` (ensLookup) | Server-side name/avatar on SIWE verify |
| `src/components/shared/ens-avatar.tsx` | Client-side avatar display |
| `src/components/simplekit/components/account.tsx` | Wallet modal name/avatar |

## UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `ConnectSIWEButton` | `src/components/auth/connect-siwe-button.tsx` | Login/register SIWE button |
| `LinkWalletDialog` | `src/components/auth/link-wallet-dialog.tsx` | Link additional wallets |
| `WalletList` | `src/components/auth/wallet-list.tsx` | Show/unlink linked wallets |
| `EnsAvatar` | `src/components/shared/ens-avatar.tsx` | ENS avatar image |

## Utilities

**Address formatting:** `src/lib/format.ts`

```ts
formatAddress("0x1234567890abcdef...") // → "0x1234...cdef"
```

## Environment Variables

| Variable | Side | Required | Description |
|----------|------|----------|-------------|
| `ENABLE_SIWE` | Server | No (default: `true`) | Enable SIWE authentication |
| `VITE_WALLETCONNECT_PROJECT_ID` | Client | No | WalletConnect v2 project ID |
| `VITE_AUTH_URL` | Client | No | Auth server URL (for SIWE domain/URI) |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SIWE verify fails | Check `BETTER_AUTH_URL` hostname matches the domain in the SIWE message |
| WalletConnect not showing | Set `VITE_WALLETCONNECT_PROJECT_ID` env var |
| ENS not resolving | ENS lookup uses mainnet RPC — ensure network connectivity |
| Auto-trigger loops | `useSiweAutoTrigger` tracks per-address; check `autoTriggeredRef` |
| Wallet link fails | User must be authenticated first; SIWE creates a linked account |
