# Raw WalletConnect v2 Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-friendly Raw WalletConnect v2 diagnostics page that compares required and optional namespace proposals, inspects MetaMask Mobile approvals, executes guarded and experimental wallet requests, records events, restores sessions, and exports results.

**Architecture:** Use Vite, React, and TypeScript for a single-page application. Keep WalletConnect protocol logic in focused pure modules, isolate `@walletconnect/sign-client` lifecycle handling in one adapter, and expose shared UI state through a Zustand store. Derive approved chains from CAIP-10 accounts in approved sessions instead of assuming an approved namespace `chains` field exists.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Zustand, `@walletconnect/sign-client`, `@walletconnect/utils`, `qrcode.react`, and `viem`.

---

## File Map

Create these files. Keep each file focused on the responsibility listed here.

```text
.env.example                         Public client configuration example
.gitignore                           Local and generated file exclusions
README.md                            Setup and manual MetaMask test guide
index.html                           Vite HTML entry point
package.json                         Scripts and dependencies
tsconfig.json                        TypeScript project references
tsconfig.app.json                    Browser TypeScript configuration
tsconfig.node.json                   Vite configuration TypeScript settings
vite.config.ts                       Vite and Vitest settings
src/main.tsx                         React entry point
src/App.tsx                          Page composition and initialization
src/styles.css                       Mobile-first diagnostic layout
src/vite-env.d.ts                    Vite environment types
src/test/setup.ts                    Testing Library cleanup
src/walletconnect/chains.ts          Chain metadata and EIP-3085 parameters
src/walletconnect/chains.test.ts     Chain metadata tests
src/walletconnect/namespaces.ts      Required and optional namespace profiles
src/walletconnect/namespaces.test.ts Proposal builder tests
src/walletconnect/session.ts         CAIP-10 parser and permission matrix
src/walletconnect/session.test.ts    Session parser and guard tests
src/walletconnect/requestParams.ts   Signing and transaction parameter builders
src/walletconnect/requestParams.test.ts Request parameter tests
src/walletconnect/deeplinks.ts       MetaMask links
src/walletconnect/deeplinks.test.ts  MetaMask link tests
src/diagnostics/eventLog.ts          Event normalization and URI shortening
src/diagnostics/eventLog.test.ts     Event normalization tests
src/diagnostics/exportResult.ts      JSON download builder
src/diagnostics/exportResult.test.ts Export tests
src/storage/wcStorageDebug.ts        SDK session, pairing, and storage helpers
src/state/useDiagnosticsStore.ts     Shared application state and actions
src/walletconnect/signClient.ts      Raw SignClient adapter and subscriptions
src/walletconnect/requests.ts        Guarded request execution
src/components/Panel.tsx             Shared collapsible panel
src/components/StatusHeader.tsx      Connection summary and ARIA live status
src/components/ProfilePanel.tsx      Profile selection and proposal preview
src/components/ConnectionPanel.tsx   QR, MetaMask links, connect, disconnect
src/components/SessionInspector.tsx  Approved session JSON and CAIP-10 accounts
src/components/PermissionMatrix.tsx  Chain-by-chain action availability
src/components/RequestLab.tsx        Safe and unsafe wallet action forms
src/components/EventTimeline.tsx     Filtered diagnostic event timeline
src/components/StoragePanel.tsx      Restored sessions, pairings, and clear
```

## Task 1: Scaffold The Vite Application

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/vite-env.d.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json`:

```json
{
  "name": "metamask-raw-wc2",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc -b --pretty false"
  },
  "dependencies": {
    "@walletconnect/sign-client": "^2.21.0",
    "@walletconnect/utils": "^2.21.0",
    "qrcode.react": "^4.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "viem": "^2.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Add Vite, TypeScript, and environment configuration**

Create `.env.example`:

```text
VITE_WC_PROJECT_ID=
VITE_MAINNET_RPC_URL=
VITE_SEPOLIA_RPC_URL=
VITE_POLYGON_AMOY_RPC_URL=
```

Create a local `.env` from the provided Reown project ID and RPC URLs. Store
the project ID under the application key `VITE_WC_PROJECT_ID`; do not add a
runtime input or commit `.env`.

Create `.gitignore`:

```text
node_modules/
dist/
.env
*.local
coverage/
```

Configure Vite with React and Vitest using `jsdom`, `globals: true`, and
`setupFiles: ['./src/test/setup.ts']`. Add browser and Vitest types to
`tsconfig.app.json`.

- [ ] **Step 3: Add the minimal React entry point**

Create `src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>Raw WalletConnect v2 Diagnostics</h1>
      <p>MetaMask Mobile namespace permission experiments.</p>
    </main>
  );
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Install dependencies and verify the scaffold**

Run:

```bash
npm install
npm run lint
npm run build
```

Expected: dependencies install successfully and the production build completes.

- [ ] **Step 5: Commit the scaffold**

```bash
git add .env.example .gitignore index.html package.json package-lock.json tsconfig*.json vite.config.ts src
git commit -m "chore: scaffold WalletConnect diagnostics app"
```

## Task 2: Add Chain Metadata And Request Parameter Builders

**Files:**
- Create: `src/walletconnect/chains.ts`
- Create: `src/walletconnect/chains.test.ts`
- Create: `src/walletconnect/requestParams.ts`
- Create: `src/walletconnect/requestParams.test.ts`

- [ ] **Step 1: Write failing chain and request parameter tests**

Test these exact behaviors:

```ts
expect(getChain('sepolia').caip2).toBe('eip155:11155111');
expect(buildAddChainParams(getChain('polygonAmoy'))[0].chainId).toBe('0x13882');
expect(buildSwitchChainParams(getChain('sepolia'))).toEqual([{ chainId: '0xaa36a7' }]);
expect(buildPersonalSignParams('hello', '0xabc')).toEqual(['0x68656c6c6f', '0xabc']);
expect(buildTypedData('0xabc', getChain('mainnet')).domain.chainId).toBe(1);
expect(buildNativeTransaction('0xabc', '0xdef', '0')).toMatchObject({
  from: '0xabc',
  to: '0xdef',
  value: '0x0',
});
```

Add an ERC-20 assertion using `decodeFunctionData` from `viem` to verify the
encoded function name is `transfer` and its arguments are the entered recipient
and parsed token amount.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/walletconnect/chains.test.ts src/walletconnect/requestParams.test.ts
```

Expected: FAIL because the chain and parameter modules do not exist.

- [ ] **Step 3: Implement the chain metadata**

Create:

```ts
export type ChainKey = 'mainnet' | 'sepolia' | 'polygonAmoy';

export interface ChainMeta {
  key: ChainKey;
  caip2: `eip155:${number}`;
  chainId: number;
  hexChainId: `0x${string}`;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const CHAINS: Record<ChainKey, ChainMeta> = {
  mainnet: {
    key: 'mainnet',
    caip2: 'eip155:1',
    chainId: 1,
    hexChainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [import.meta.env.VITE_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  sepolia: {
    key: 'sepolia',
    caip2: 'eip155:11155111',
    chainId: 11155111,
    hexChainId: '0xaa36a7',
    chainName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  polygonAmoy: {
    key: 'polygonAmoy',
    caip2: 'eip155:80002',
    chainId: 80002,
    hexChainId: '0x13882',
    chainName: 'Polygon Amoy',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: [import.meta.env.VITE_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology'],
    blockExplorerUrls: ['https://amoy.polygonscan.com'],
  },
};

export const CHAIN_LIST = Object.values(CHAINS);
export const getChain = (key: ChainKey) => CHAINS[key];
```

- [ ] **Step 4: Implement request parameter builders**

Use `stringToHex`, `parseEther`, `parseUnits`, and `encodeFunctionData` from
`viem`. Export:

```ts
buildSwitchChainParams(chain)
buildAddChainParams(chain)
buildPersonalSignParams(message, address)
buildTypedData(address, chain)
buildTypedDataParams(address, chain)
buildNativeTransaction(from, to, amount)
buildErc20Transaction(from, token, recipient, amount, decimals)
```

Use a numeric `domain.chainId`, `[messageHex, address]` ordering for
`personal_sign`, and an ERC-20 ABI containing only
`transfer(address recipient, uint256 amount)`.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/walletconnect/chains.test.ts src/walletconnect/requestParams.test.ts
```

Expected: PASS.

```bash
git add src/walletconnect/chains* src/walletconnect/requestParams*
git commit -m "feat: add chain metadata and wallet request parameters"
```

## Task 3: Build Namespace Profiles

**Files:**
- Create: `src/walletconnect/namespaces.ts`
- Create: `src/walletconnect/namespaces.test.ts`

- [ ] **Step 1: Write failing profile tests**

Assert:

```ts
expect(buildNamespaceProposal('mainnet-only-required', 'sepolia')).toMatchObject({
  requiredNamespaces: { eip155: { chains: ['eip155:1'] } },
});

expect(buildNamespaceProposal('mainnet-required-testnets-optional', 'sepolia'))
  .toMatchObject({
    requiredNamespaces: { eip155: { chains: ['eip155:1'] } },
    optionalNamespaces: {
      eip155: { chains: ['eip155:11155111', 'eip155:80002'] },
    },
  });

expect(buildNamespaceProposal('single-target-required', 'sepolia')).toMatchObject({
  requiredNamespaces: { eip155: { chains: ['eip155:11155111'] } },
  optionalNamespaces: {
    eip155: { chains: ['eip155:1', 'eip155:80002'] },
  },
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/walletconnect/namespaces.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement profile and proposal builders**

Export:

```ts
export type NamespaceProfileId =
  | 'mainnet-only-required'
  | 'strict-three-chains-required'
  | 'mainnet-required-testnets-optional'
  | 'single-target-required';

export const DEFAULT_METHODS = [
  'personal_sign',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
  'wallet_getPermissions',
  'wallet_requestPermissions',
  'wallet_getCapabilities',
];

export const DEFAULT_EVENTS = ['accountsChanged', 'chainChanged'];

export function buildNamespaceProposal(
  profileId: NamespaceProfileId,
  target: ChainKey,
) {
  const allChains = Object.values(CHAINS).map((chain) => chain.caip2);
  const targetChain = CHAINS[target].caip2;
  const profileChains = {
    'mainnet-only-required': {
      required: [CHAINS.mainnet.caip2],
      optional: [],
    },
    'strict-three-chains-required': {
      required: allChains,
      optional: [],
    },
    'mainnet-required-testnets-optional': {
      required: [CHAINS.mainnet.caip2],
      optional: [CHAINS.sepolia.caip2, CHAINS.polygonAmoy.caip2],
    },
    'single-target-required': {
      required: [targetChain],
      optional: allChains.filter((chain) => chain !== targetChain),
    },
  }[profileId];
  const buildNamespace = (chains: string[]) => ({
    chains,
    methods: DEFAULT_METHODS,
    events: DEFAULT_EVENTS,
  });
  return {
    requiredNamespaces: { eip155: buildNamespace(profileChains.required) },
    ...(profileChains.optional.length > 0
      ? { optionalNamespaces: { eip155: buildNamespace(profileChains.optional) } }
      : {}),
  };
}
```

Omit `optionalNamespaces` entirely when the profile has no optional chains.
Include the same methods and events in required and optional EIP-155 namespaces
so proposal differences are limited to chain placement.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- src/walletconnect/namespaces.test.ts
```

Expected: PASS.

```bash
git add src/walletconnect/namespaces*
git commit -m "feat: add WalletConnect namespace profiles"
```

## Task 4: Parse Approved Sessions And Guard Safe Requests

**Files:**
- Create: `src/walletconnect/session.ts`
- Create: `src/walletconnect/session.test.ts`

- [ ] **Step 1: Write failing CAIP-10 parsing tests**

Use a fixture with no approved namespace `chains` field:

```ts
const session = {
  topic: 'topic-1',
  expiry: 2000000000,
  namespaces: {
    eip155: {
      accounts: [
        'eip155:1:0xabc',
        'eip155:11155111:0xabc',
      ],
      methods: ['personal_sign', 'wallet_switchEthereumChain'],
      events: ['accountsChanged', 'chainChanged'],
    },
  },
  peer: { metadata: { name: 'MetaMask', url: 'https://metamask.io', icons: [] } },
};
```

Assert that parsing produces approved chains `['eip155:1', 'eip155:11155111']`,
groups accounts by CAIP-2 chain, marks Sepolia as switchable, and marks Polygon
Amoy as lacking an approved account.

- [ ] **Step 2: Write failing safe guard tests**

Assert that `assertCanRequest(parsed, getChain('mainnet'), 'personal_sign')`
does not throw, but Polygon Amoy signing and switching throw
`No approved account for chain: eip155:80002`.

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- src/walletconnect/session.test.ts
```

Expected: FAIL because the parser does not exist.

- [ ] **Step 4: Implement session parsing and guards**

Export:

```ts
export interface ParsedSessionState {
  topic: string;
  expiry: number;
  peerName?: string;
  peerUrl?: string;
  peerIcons: string[];
  approvedChains: string[];
  approvedAccounts: Record<string, string[]>;
  approvedMethods: string[];
  approvedEvents: string[];
  raw: unknown;
}

export interface ChainPermissionState {
  chainKey: ChainKey;
  caip2: string;
  accounts: string[];
  hasAccount: boolean;
  canSign: boolean;
  canSendTransaction: boolean;
  canSwitchSafely: boolean;
  notes: string[];
}

export function extractChainFromAccount(account: string): string | undefined {
  const [namespace, reference, address] = account.split(':');
  return namespace && reference && address ? `${namespace}:${reference}` : undefined;
}
```

Implement `parseSession`, `buildPermissionMatrix`, and `assertCanRequest`.
Approved chains come from the CAIP-10 account prefixes only. The safe guard
checks account availability before method approval so missing-chain
experiments produce a useful message.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/walletconnect/session.test.ts
```

Expected: PASS.

```bash
git add src/walletconnect/session*
git commit -m "feat: derive approved chain permissions from CAIP-10 accounts"
```

## Task 5: Add Diagnostics, Deep Links, And Export

**Files:**
- Create: `src/walletconnect/deeplinks.ts`
- Create: `src/walletconnect/deeplinks.test.ts`
- Create: `src/diagnostics/eventLog.ts`
- Create: `src/diagnostics/eventLog.test.ts`
- Create: `src/diagnostics/exportResult.ts`
- Create: `src/diagnostics/exportResult.test.ts`

- [ ] **Step 1: Write failing utility tests**

Assert:

```ts
expect(buildMetaMaskUniversalLink('wc:test@2')).toBe(
  'https://metamask.app.link/wc?uri=wc%3Atest%402',
);
expect(buildMetaMaskDeepLink('wc:test@2')).toBe(
  'metamask://wc?uri=wc%3Atest%402',
);
expect(shortenWalletConnectUri('wc:abcdefghijk@2?relay-protocol=irn'))
  .toBe('wc:abcdef...ijk@2');
expect(createDiagnosticEvent({
  source: 'ui',
  type: 'connect_started',
  payload: { uri: 'wc:abcdefghijk@2?relay-protocol=irn' },
}).payload).toEqual({ uri: 'wc:abcdef...ijk@2' });
```

Test that exports exclude full pairing URIs unless
`includeSensitiveValues: true`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/walletconnect/deeplinks.test.ts src/diagnostics
```

Expected: FAIL because the utilities do not exist.

- [ ] **Step 3: Implement the utilities**

Create a `DiagnosticEvent` with:

```ts
type DiagnosticEventSource = 'ui' | 'signClient' | 'request' | 'page' | 'storage';

interface DiagnosticEvent {
  id: string;
  at: string;
  source: DiagnosticEventSource;
  type: string;
  summary: string;
  payload?: unknown;
}
```

Normalize nested payloads recursively and shorten values beginning with `wc:`.
Build downloads with `Blob`, `URL.createObjectURL`, a temporary anchor, and
`URL.revokeObjectURL`.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- src/walletconnect/deeplinks.test.ts src/diagnostics
```

Expected: PASS.

```bash
git add src/walletconnect/deeplinks* src/diagnostics
git commit -m "feat: add diagnostic event logging and export"
```

## Task 6: Add Store, SignClient Lifecycle, And Storage Diagnostics

**Files:**
- Create: `src/state/useDiagnosticsStore.ts`
- Create: `src/walletconnect/signClient.ts`
- Create: `src/storage/wcStorageDebug.ts`

- [ ] **Step 1: Define the store contract**

Create a Zustand store containing:

```ts
type ConnectionStatus =
  | 'idle'
  | 'sign_client_initializing'
  | 'pairing_uri_ready'
  | 'approval_pending'
  | 'connected'
  | 'expired'
  | 'disconnected'
  | 'error';

interface DiagnosticsState {
  status: ConnectionStatus;
  profileId: NamespaceProfileId;
  targetChainKey: ChainKey;
  uri?: string;
  activeSession?: SessionTypes.Struct;
  parsedSession?: ParsedSessionState;
  sessions: SessionTypes.Struct[];
  pairings: PairingTypes.Struct[];
  events: DiagnosticEvent[];
  restoredFromStorage: boolean;
  lastError?: string;
  pendingRequestIds: string[];
}
```

Add narrow actions for status, selected profile, target chain, URI, active
session, restored lists, errors, pending requests, event appends, and reset.

- [ ] **Step 2: Implement SignClient initialization and subscriptions**

In `src/walletconnect/signClient.ts`, export:

```ts
initializeSignClient()
getSignClient()
connectWithProfile(profileId, targetChainKey)
disconnectActiveSession()
refreshRestoredState()
selectRestoredSession(topic)
pingActiveSession()
```

Read `import.meta.env.VITE_WC_PROJECT_ID` and throw
`Missing VITE_WC_PROJECT_ID` before calling `SignClient.init()` when empty.
Register `session_update`, `session_event`, `session_delete`, `session_expire`,
`session_extend`, `session_ping`, and `proposal_expire`. Every handler appends
an event and refreshes the active session when its topic remains valid.

For connection:

```ts
const proposal = buildNamespaceProposal(profileId, targetChainKey);
const { uri, approval } = await client.connect(proposal);
store.setUri(uri);
store.setStatus('pairing_uri_ready');
const session = await approval();
store.setActiveSession(session);
store.setStatus('connected');
```

Keep connect disabled while status is initializing, pairing, or pending so
duplicate approval promises cannot be created.

- [ ] **Step 3: Implement storage diagnostics**

Expose SDK lists through `client.session.getAll()` and
`client.pairing.getAll({ active: true })`. Add `clearWalletConnectStorage()`
that asks the caller to confirm first, disconnects active sessions where
possible, clears local keys beginning with `wc@2:` or containing
`walletconnect`, and reloads the page.

- [ ] **Step 4: Add lifecycle logging in the app**

In `src/App.tsx`, initialize the client once and register:

```ts
visibilitychange
focus
blur
pageshow
beforeunload
```

Log each event through the store with source `page`.

- [ ] **Step 5: Type-check and commit**

Run:

```bash
npm run lint
```

Expected: PASS.

```bash
git add src/state src/storage src/walletconnect/signClient.ts src/App.tsx
git commit -m "feat: add raw SignClient lifecycle and session restore"
```

## Task 7: Execute Safe And Unsafe Wallet Requests

**Files:**
- Create: `src/walletconnect/requests.ts`

- [ ] **Step 1: Implement the request executor**

Export:

```ts
export type RequestMode = 'safe' | 'unsafe';

interface WalletAction {
  chain: ChainMeta;
  method: string;
  params: unknown[];
  mode: RequestMode;
  unsafeReason?: string;
}

export async function requestWalletAction(action: WalletAction): Promise<unknown>
```

Read the active session and parsed session from the store. In safe mode call
`assertCanRequest`. In unsafe mode require a non-empty `unsafeReason`. Record
`${method}:pending`, `${method}:success`, and `${method}:error` events with the
target chain, params, mode, unsafe reason, and session snapshot. Track a random
request ID in `pendingRequestIds` and remove it in `finally`.

- [ ] **Step 2: Add request-specific wrappers**

Export wrappers:

```ts
requestPersonalSign(input)
requestTypedDataSign(input)
requestNativeTransfer(input)
requestErc20Transfer(input)
requestSwitchChain(input)
requestAddChain(input)
requestGetPermissions(input)
requestPermissions(input)
requestCapabilities(input)
```

Each wrapper uses the builders from `requestParams.ts` and delegates to
`requestWalletAction`. After `wallet_addEthereumChain`, refresh restored state
and append a session snapshot event so namespace changes can be compared.

- [ ] **Step 3: Type-check and commit**

Run:

```bash
npm run lint
```

Expected: PASS.

```bash
git add src/walletconnect/requests.ts
git commit -m "feat: execute guarded WalletConnect wallet actions"
```

## Task 8: Build Shared Panels, Status, And Profile Preview

**Files:**
- Create: `src/components/Panel.tsx`
- Create: `src/components/StatusHeader.tsx`
- Create: `src/components/ProfilePanel.tsx`

- [ ] **Step 1: Implement the collapsible panel**

Build a semantic `<section>` with a heading button, `aria-expanded`, and a
content region. It accepts `title`, optional `summary`, `defaultOpen`, and
children.

- [ ] **Step 2: Implement the status header**

Display status, profile name, target chain, shortened topic, expiry, restored
state, latest event summary, and last error. Add:

```tsx
<p className="sr-only" aria-live="polite">
  {statusMessage}
</p>
```

- [ ] **Step 3: Implement profile selection and JSON preview**

Render profile and target chain `<select>` controls with labels. Compute
`buildNamespaceProposal(profileId, targetChainKey)` and display it in a
horizontally scrollable `<pre>`. Include a copy button using
`navigator.clipboard.writeText`.

- [ ] **Step 4: Add component tests**

Use Testing Library to assert that changing the profile to
`mainnet-required-testnets-optional` displays both `requiredNamespaces` and
`optionalNamespaces`, and that the status header contains an ARIA live region.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/components
```

Expected: PASS.

```bash
git add src/components
git commit -m "feat: add status and namespace profile panels"
```

## Task 9: Build Connection, Inspector, Matrix, And Storage Panels

**Files:**
- Create: `src/components/ConnectionPanel.tsx`
- Create: `src/components/SessionInspector.tsx`
- Create: `src/components/PermissionMatrix.tsx`
- Create: `src/components/StoragePanel.tsx`

- [ ] **Step 1: Implement connection controls**

Render connect, disconnect, and clear-storage buttons. When a URI exists,
render `QRCodeSVG`, a shortened URI, copy URI, MetaMask universal link, and
MetaMask deep link. Call link navigation only from direct user click handlers.
Disable connect during initialization, pairing, approval, and connected
states.

- [ ] **Step 2: Implement session inspector**

Display peer metadata, expiry, approved chains derived from CAIP-10 accounts,
addresses grouped by chain, methods, events, and horizontally scrollable raw
JSON. When there is no active session, display `No active session`.

- [ ] **Step 3: Implement the mobile-first permission matrix**

Use cards instead of a wide table on narrow screens. Each card displays chain,
approved addresses, `Can sign`, `Can send transaction`, `Can switch safely`,
and notes. Use visible `Yes` and `No` text in addition to color.

- [ ] **Step 4: Implement storage diagnostics**

Display restored sessions and active pairings. Allow selecting a restored
session, pinging the active session, refreshing lists, and clearing storage
after `window.confirm`.

- [ ] **Step 5: Add component tests**

Use a store reset in `beforeEach`. Assert that a Mainnet-only session renders
`Can sign: Yes` on Mainnet and `Can sign: No` on Sepolia. Assert that the
connection panel hides QR markup until a URI exists.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- src/components
```

Expected: PASS.

```bash
git add src/components
git commit -m "feat: add connection and session diagnostic panels"
```

## Task 10: Build The Request Lab With Transfer Confirmation

**Files:**
- Create: `src/components/RequestLab.tsx`

- [ ] **Step 1: Implement request type selection**

Provide a labeled select for every supported request:

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

Render only the fields needed for the selected request. Use the selected target
chain from the store.

- [ ] **Step 2: Implement safe and unsafe execution**

Safe is the default. Unsafe execution requires a checkbox and a non-empty
reason field. Display a warning that the request may trigger
`accountsChanged([])`, fail silently, or produce wallet-specific behavior.

- [ ] **Step 3: Add transfer confirmation**

Native and ERC-20 transfers require explicitly entered recipient and amount.
ERC-20 also requires token address and decimals. On submit, open an in-page
confirmation block showing chain, token or native currency, recipient, amount,
and a Mainnet warning when `targetChainKey === 'mainnet'`. Only its confirm
button invokes the request wrapper.

- [ ] **Step 4: Add Request Lab tests**

Assert that:

```text
native transfer cannot be confirmed with empty recipient or amount
ERC-20 transfer cannot be confirmed without token, recipient, amount, decimals
unsafe execution cannot run without a reason
Mainnet confirmation visibly includes an additional warning
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/components/RequestLab.test.tsx
```

Expected: PASS.

```bash
git add src/components/RequestLab*
git commit -m "feat: add wallet request lab and transfer confirmation"
```

## Task 11: Add Timeline, Export UI, And Final Composition

**Files:**
- Create: `src/components/EventTimeline.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement the event timeline**

Render events newest first with source and type filters, timestamp, summary,
expandable JSON payload, and clear button. Add notes input, include-sensitive
checkbox, and export button wired to `downloadExperimentExport`.

- [ ] **Step 2: Compose the page**

Render:

```tsx
<StatusHeader />
<ProfilePanel />
<ConnectionPanel />
<SessionInspector />
<PermissionMatrix />
<RequestLab />
<EventTimeline />
<StoragePanel />
```

Show a visible configuration error when `VITE_WC_PROJECT_ID` is missing.

- [ ] **Step 3: Add mobile-first styles**

Define:

```css
.app-shell { max-width: 1080px; margin: 0 auto; padding: 1rem; }
.panel { border: 1px solid #d0d7de; border-radius: 0.75rem; margin-block: 0.75rem; }
.panel-body { padding: 1rem; }
.json-block { overflow-x: auto; white-space: pre; }
.permission-grid { display: grid; gap: 0.75rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
@media (min-width: 720px) {
  .permission-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
```

Add clear warning, success, and failure styles that still include readable text.

- [ ] **Step 4: Run tests, type-check, and build**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests PASS, TypeScript reports no errors, and Vite creates
`dist/`.

- [ ] **Step 5: Commit the composed UI**

```bash
git add src
git commit -m "feat: compose mobile WalletConnect diagnostics page"
```

## Task 12: Document Setup And Manual MetaMask Validation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Document local setup**

Include:

```bash
cp .env.example .env
npm install
npm run dev
```

Explain that `VITE_WC_PROJECT_ID` is required and is public client
configuration, not a secret. Explain optional RPC overrides.

- [ ] **Step 2: Document the experiment matrix**

For each of the four namespace profiles, document:

```text
1. Preview and capture proposal JSON.
2. Start a fresh connection.
3. Capture the MetaMask Mobile permission screen manually.
4. Approve or reject.
5. Inspect CAIP-10 accounts and the permission matrix.
6. Export JSON.
```

Add separate procedures for unsafe Sepolia switching, add-chain comparison,
refresh restore, wallet-side disconnect, native transfer, and ERC-20 transfer.
State clearly that Mainnet transfers can move real assets.

- [ ] **Step 3: Run the complete automated verification**

Run:

```bash
npm test
npm run lint
npm run build
git status --short
```

Expected: tests, type-check, and build pass. Only intentional files appear in
Git status.

- [ ] **Step 4: Perform local browser smoke testing**

Run:

```bash
npm run dev
```

Open the displayed local URL and verify:

```text
configuration error appears when VITE_WC_PROJECT_ID is missing
profile proposal preview changes for each profile
optionalNamespaces appears for the optional profile
panels collapse and expand on a narrow viewport
transfer confirmation blocks execution until explicit confirmation
```

Full MetaMask Mobile validation remains manual because the permission UI runs
inside the mobile wallet.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md
git commit -m "docs: add WalletConnect diagnostics test guide"
```

## Final Verification Checklist

Run:

```bash
npm test
npm run lint
npm run build
git log --oneline --decorate -12
git status --short --branch
```

Expected:

```text
all Vitest suites pass
TypeScript reports no errors
Vite production build completes
commits are split by working capability
pre-existing untracked files remain untouched unless explicitly adopted
```

Then perform the four-profile MetaMask Mobile experiment and attach exported
JSON files to the issue or investigation notes.
