import { CHAIN_LIST, type ChainKey, type ChainMeta } from './chains';

interface SessionNamespace {
  accounts?: unknown;
  chains?: unknown;
  methods?: unknown;
  events?: unknown;
}

interface SessionInput {
  topic: string;
  pairingTopic?: string;
  expiry: number;
  namespaces?: Record<string, SessionNamespace | undefined>;
  requiredNamespaces?: Record<string, SessionNamespace | undefined>;
  optionalNamespaces?: Record<string, SessionNamespace | undefined>;
  peer?: {
    metadata?: {
      name?: string;
      url?: string;
      icons?: unknown;
    };
  };
}

export interface ParsedSessionState {
  topic: string;
  pairingTopic?: string;
  expiry: number;
  peerName?: string;
  peerUrl?: string;
  peerIcons: string[];
  approvedChains: string[];
  approvedAccounts: Record<string, string[]>;
  proposedMethods?: string[];
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
  methodApprovals: Record<string, boolean>;
  notes: string[];
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}

export function extractChainFromAccount(account: string): string | undefined {
  const [namespace, reference, ...addressParts] = account.split(':');
  return namespace && reference && addressParts.join(':')
    ? `${namespace}:${reference}`
    : undefined;
}

export function parseSession(session: SessionInput): ParsedSessionState {
  const namespace = session.namespaces?.eip155;
  const proposedMethods = uniqueStrings([
    ...uniqueStrings(session.requiredNamespaces?.eip155?.methods),
    ...uniqueStrings(session.optionalNamespaces?.eip155?.methods),
    ...uniqueStrings(namespace?.methods),
  ]);
  const approvedAccounts: Record<string, string[]> = {};

  for (const account of uniqueStrings(namespace?.accounts)) {
    const chain = extractChainFromAccount(account);
    if (!chain) {
      continue;
    }

    const address = account.slice(chain.length + 1);
    approvedAccounts[chain] ??= [];
    if (!approvedAccounts[chain].includes(address)) {
      approvedAccounts[chain].push(address);
    }
  }

  return {
    topic: session.topic,
    pairingTopic: session.pairingTopic,
    expiry: session.expiry,
    peerName: session.peer?.metadata?.name,
    peerUrl: session.peer?.metadata?.url,
    peerIcons: uniqueStrings(session.peer?.metadata?.icons),
    approvedChains: Object.keys(approvedAccounts),
    approvedAccounts,
    proposedMethods,
    approvedMethods: uniqueStrings(namespace?.methods),
    approvedEvents: uniqueStrings(namespace?.events),
    raw: session,
  };
}

function buildPermissionNotes(
  hasAccount: boolean,
  approvedMethods: string[],
): string[] {
  const notes: string[] = [];

  if (!hasAccount) {
    notes.push('No approved account for chain');
  }
  if (!approvedMethods.includes('personal_sign')) {
    notes.push('personal_sign not approved');
  }
  if (!approvedMethods.includes('eth_sendTransaction')) {
    notes.push('eth_sendTransaction not approved');
  }
  if (!approvedMethods.includes('wallet_switchEthereumChain')) {
    notes.push('wallet_switchEthereumChain not approved');
  }

  return notes;
}

export function buildPermissionMatrix(
  session: ParsedSessionState,
): ChainPermissionState[] {
  return CHAIN_LIST.map((chain) => {
    const accounts = session.approvedAccounts[chain.caip2] ?? [];
    const hasAccount = accounts.length > 0;
    const methodApprovals = Object.fromEntries(
      (session.proposedMethods ?? session.approvedMethods).map((method) => [
        method,
        session.approvedMethods.includes(method),
      ]),
    );

    return {
      chainKey: chain.key,
      caip2: chain.caip2,
      accounts,
      hasAccount,
      canSign: hasAccount && session.approvedMethods.includes('personal_sign'),
      canSendTransaction:
        hasAccount && session.approvedMethods.includes('eth_sendTransaction'),
      canSwitchSafely:
        hasAccount &&
        session.approvedMethods.includes('wallet_switchEthereumChain'),
      methodApprovals,
      notes: buildPermissionNotes(hasAccount, session.approvedMethods),
    };
  });
}

export function assertCanRequest(
  session: ParsedSessionState,
  chain: ChainMeta,
  method: string,
): void {
  if ((session.approvedAccounts[chain.caip2] ?? []).length === 0) {
    throw new Error(`No approved account for chain: ${chain.caip2}`);
  }

  if (!session.approvedMethods.includes(method)) {
    throw new Error(`Method not approved: ${method}`);
  }
}
