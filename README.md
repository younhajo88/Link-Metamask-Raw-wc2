# Raw WalletConnect v2 Diagnostics

Raw `@walletconnect/sign-client` test page for inspecting how MetaMask Mobile
handles `requiredNamespaces`, `optionalNamespaces`, approved CAIP-10 accounts,
chain switching, chain addition, session restore, and wallet-side disconnects.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Set:

```text
VITE_WC_PROJECT_ID=
```

The WalletConnect project ID is public browser configuration, not a secret.
Optional RPC overrides:

```text
VITE_MAINNET_RPC_URL=
VITE_SEPOLIA_RPC_URL=
VITE_POLYGON_AMOY_RPC_URL=
```

Do not put private RPC credentials in `VITE_` variables because Vite bundles
them into browser code.

## Namespace Experiments

For each profile:

1. Preview and capture the proposal JSON.
2. Start a fresh WalletConnect connection.
3. Capture the MetaMask Mobile permission screen manually.
4. Approve or reject the proposal.
5. Inspect the approved CAIP-10 accounts and permission matrix.
6. Export the diagnostic JSON.

Profiles:

- Mainnet only required
- Mainnet, Sepolia, and Polygon Amoy required
- Mainnet required with Sepolia and Polygon Amoy optional
- Selected target chain required with remaining chains optional

## Additional Scenarios

### Unsafe Sepolia Switch

Connect with Mainnet only, select Sepolia in the request lab, choose
`wallet_switchEthereumChain`, enable unsafe mode, record the reason, and run the
request. Inspect `chainChanged`, `accountsChanged([])`, and session update
events.

Unsafe switch and add-chain experiments route the WalletConnect request through
an approved account chain when the target chain is not approved. This helps the
request reach the wallet, but it cannot bypass SDK-level method validation.

### Add Chain Comparison

Run `wallet_addEthereumChain`, then compare the session snapshot before and
after the request. Adding a network to MetaMask does not guarantee that the
WalletConnect session namespace expands.

### Restore And Wallet-Side Disconnect

Reload after approval and select a restored session in the Storage panel. Also
remove the dApp connection inside MetaMask Mobile, return to the browser, and
inspect session delete or stale-session recovery events.

### Transfers

The request lab supports native and ERC-20 transfers. Recipients and amounts
must be entered explicitly and confirmed before sending. Mainnet requests can
move real assets.

## Verification

```bash
npm test
npm run lint
npm run build
```

MetaMask permission screens run inside the mobile wallet, so the four profile
experiments remain manual.
