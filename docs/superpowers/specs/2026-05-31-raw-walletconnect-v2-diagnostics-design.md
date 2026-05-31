# Raw WalletConnect v2 Diagnostics Page Design

## Goal

Build a single-page diagnostic application that uses
`@walletconnect/sign-client` directly. The application is intended to verify how
MetaMask Mobile handles network permissions during the initial WalletConnect v2
connection, especially the difference between `requiredNamespaces` and
`optionalNamespaces`.

The page must avoid Wagmi, Reown AppKit, `@walletconnect/ethereum-provider`, and
`@walletconnect/universal-provider`. The purpose is to inspect the raw proposal,
approved session, requests, and wallet events without connector abstractions.

## Configuration

The WalletConnect project ID is read only from:

```text
VITE_WC_PROJECT_ID=
```

There is no runtime Project ID input. RPC endpoints may be overridden through:

```text
VITE_MAINNET_RPC_URL=
VITE_SEPOLIA_RPC_URL=
VITE_POLYGON_AMOY_RPC_URL=
```

`VITE_` variables are bundled into client-side code and must not contain
secrets.

## Supported Chains

| Chain | CAIP-2 | Hex chain ID | Native currency |
| --- | --- | --- | --- |
| Ethereum Mainnet | `eip155:1` | `0x1` | ETH |
| Sepolia | `eip155:11155111` | `0xaa36a7` | ETH |
| Polygon Amoy | `eip155:80002` | `0x13882` | POL |

## Namespace Profiles

The page provides four profiles and previews the generated proposal JSON before
connection.

| Profile | Required chains | Optional chains |
| --- | --- | --- |
| Mainnet Only Required | Mainnet | None |
| Strict Three Chains Required | Mainnet, Sepolia, Polygon Amoy | None |
| Mainnet Required With Optional Testnets | Mainnet | Sepolia, Polygon Amoy |
| Single Target Required | Selected target chain | Remaining chains |

MetaMask Mobile may reject multi-chain required proposals or ignore optional
namespaces depending on its version. These outcomes are experiment results, not
application errors to hide.

## Architecture

```text
src/
  walletconnect/
    chains.ts          Chain metadata and EIP-3085 parameters
    namespaces.ts      Namespace profile and proposal builders
    signClient.ts      Initialization, connection, restore, and event listeners
    session.ts         CAIP-10 parsing and permission matrix calculation
    requests.ts        WalletConnect request execution
    requestParams.ts   Signing, transfer, switch, and add-chain parameter builders
    deeplinks.ts       MetaMask universal link and deep link builders
  diagnostics/
    eventLog.ts        Structured timeline events
    exportResult.ts    JSON experiment export
  storage/
    wcStorageDebug.ts  Session and pairing diagnostics
  components/
    StatusHeader.tsx
    ProfilePanel.tsx
    ConnectionPanel.tsx
    SessionInspector.tsx
    PermissionMatrix.tsx
    RequestLab.tsx
    EventTimeline.tsx
    StoragePanel.tsx
```

Use a Zustand store for shared application state. Panels are collapsible so the
page remains usable in a mobile browser.

## Data Flow

```text
Select namespace profile and target chain
  -> build proposal JSON
  -> call SignClient.connect()
  -> show QR code and MetaMask links
  -> approve or reject in MetaMask Mobile
  -> parse approved session namespaces
  -> derive chain permissions from CAIP-10 accounts
  -> run safe or explicitly unsafe requests
  -> record request lifecycle and wallet events
  -> export experiment JSON
```

## Session Parsing

The approved WalletConnect session namespace must not be assumed to have a
`chains` field. Derive approved chains from CAIP-10 accounts:

```text
eip155:1:0x...
eip155:11155111:0x...
eip155:80002:0x...
```

For each supported chain, calculate:

- Whether the session has an approved CAIP-10 account for the chain
- Which addresses are approved
- Whether each required method is approved
- Whether signing, sending, or safe switching is allowed

The raw approved session JSON remains visible in the inspector.

## Connection And Restore

Connection states:

```text
idle
sign_client_initializing
pairing_uri_ready
approval_pending
connected
expired
disconnected
error
```

Disable duplicate connection attempts while initialization, pairing, or
approval is in progress. On page load, initialize SignClient, list restored
sessions and pairings, and allow selecting an active restored session. Record
`visibilitychange`, `focus`, `blur`, `pageshow`, and `beforeunload` to diagnose
mobile browser return behavior.

Subscribe to at least:

```text
session_update
session_event
session_delete
session_expire
session_extend
session_ping
proposal_expire
```

## Request Lab

The request lab supports:

```text
personal_sign
eth_signTypedData_v4
eth_sendTransaction
ERC-20 transfer
wallet_switchEthereumChain
wallet_addEthereumChain
wallet_getPermissions
wallet_requestPermissions
wallet_getCapabilities
```

Typed data uses a numeric `domain.chainId`. WalletConnect requests use CAIP-2
chain IDs. `wallet_switchEthereumChain` and `wallet_addEthereumChain` parameters
use hex chain IDs.

### Safe Mode

Safe mode blocks a request unless the selected chain has an approved CAIP-10
account and the session approves the requested method. Safe switching also
requires an approved account for the target chain because MetaMask Mobile may
emit `accountsChanged([])` when switching to an unapproved chain.

### Unsafe Mode

Unsafe mode is opt-in per request. It bypasses the safe guard after displaying a
warning and records the reason, proposal snapshot, session snapshot, request,
result, and resulting events.

### Transfer Safety

Native and ERC-20 transfers are supported. Both require the user to enter the
recipient and amount explicitly. There are no default transfer amounts.
Display a confirmation step before execution and an additional warning for
Mainnet requests. Explicitly entered zero-value native transfers remain
allowed.

## User Interface

- Status header: connection state, profile, target chain, topic, expiry, restore
  status, and latest event.
- Profile panel: profile selection, target selection, and proposal JSON preview.
- Connection panel: connect, QR, MetaMask universal link, MetaMask deep link,
  disconnect, and storage clear.
- Session inspector: approved CAIP-10 accounts, derived chains, methods, events,
  peer metadata, and raw session JSON.
- Permission matrix: chain-by-chain approval and safe action availability.
- Request lab: safe and unsafe requests, parameters, confirmation, and result.
- Event timeline: request, SignClient, storage, and browser lifecycle events.
- Storage panel: restored sessions, pairings, active session selection, ping,
  and storage clear.

Status indicators must use text in addition to color. Inputs require labels,
and status changes should be announced through an ARIA live region.

## Diagnostics Export

Export a JSON file containing:

```text
export timestamp
selected profile
selected target chain
proposal JSON
wallet and browser notes
session before experiment
session after experiment
permission matrix
event timeline
user notes
```

Pairing URIs are sensitive. Show shortened URIs in the timeline by default and
include full values in exports only after an explicit user choice.

## Validation Scenarios

1. Connect with only Mainnet required, then attempt an unsafe Sepolia switch.
2. Connect with all three chains required and record approval or rejection.
3. Connect with Mainnet required and testnets optional; compare the proposal,
   MetaMask permission UI, and approved session.
4. Connect with Sepolia or Polygon Amoy as the single required target chain.
5. Add a chain and compare the session before and after the request.
6. Reload the browser and verify restored session diagnostics.
7. Remove the connection from MetaMask and verify local recovery behavior.
8. Run signing, native transfer, and ERC-20 transfer requests after explicit
   confirmation.

## Testing

Unit tests cover:

- Namespace profile and proposal builders
- CAIP-10 account parsing and chain derivation
- Session parsing
- Permission matrix calculation
- Safe request guards
- Deep link builders
- EIP-3085 parameters
- Typed data parameters with numeric `domain.chainId`
- Personal sign parameter ordering
- Event serialization and URI shortening

Manual testing covers MetaMask Mobile on iOS Safari and Android Chrome, QR and
deep-link connection paths, permission selection UI, app return lifecycle
events, and session restore behavior.

## Out Of Scope

- Production wallet abstraction
- Wagmi or AppKit integration
- Backend storage
- Account portfolio features
- Automated control of MetaMask Mobile permission screens

