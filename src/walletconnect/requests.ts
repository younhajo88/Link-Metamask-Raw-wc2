import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { CHAIN_LIST, type ChainMeta } from './chains';
import {
  buildAddChainParams,
  buildErc20Transaction,
  buildNativeTransaction,
  buildPersonalSignParams,
  buildSwitchChainParams,
  buildTypedDataParams,
} from './requestParams';
import { assertCanRequest, type ParsedSessionState } from './session';
import { getSignClient, refreshRestoredState } from './signClient';

export type RequestMode = 'safe' | 'unsafe';

export interface WalletAction {
  chain: ChainMeta;
  routeChain: ChainMeta;
  method: string;
  params: unknown[];
  mode: RequestMode;
  unsafeReason?: string;
}

interface BaseWalletActionInput {
  chain: ChainMeta;
  mode?: RequestMode;
  unsafeReason?: string;
}

interface PersonalSignInput extends BaseWalletActionInput {
  message: string;
}

type TypedDataSignInput = BaseWalletActionInput;

interface NativeTransferInput extends BaseWalletActionInput {
  to: string;
  amount: string;
}

interface Erc20TransferInput extends BaseWalletActionInput {
  token: string;
  recipient: string;
  amount: string;
  decimals: number;
}

interface PermissionsInput extends BaseWalletActionInput {
  params?: unknown[];
}

const getStore = () => useDiagnosticsStore.getState();

const serializeError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };

function getApprovedAccount(
  session: ParsedSessionState,
  chain: ChainMeta,
): string {
  const account = session.approvedAccounts[chain.caip2]?.[0];
  if (!account) {
    throw new Error(`No approved account for chain: ${chain.caip2}`);
  }

  return account;
}

function toAction(
  input: BaseWalletActionInput,
  method: string,
  params: unknown[],
  routeChain = input.chain,
): WalletAction {
  return {
    chain: input.chain,
    routeChain,
    method,
    params,
    mode: input.mode ?? 'safe',
    unsafeReason: input.unsafeReason,
  };
}

function getRouteChain(input: BaseWalletActionInput): ChainMeta {
  if (input.mode !== 'unsafe') {
    return input.chain;
  }

  const approvedAccounts = getStore().parsedSession?.approvedAccounts;
  if (!approvedAccounts || approvedAccounts[input.chain.caip2]?.length) {
    return input.chain;
  }

  return (
    CHAIN_LIST.find((chain) => approvedAccounts[chain.caip2]?.length) ??
    input.chain
  );
}

export async function requestWalletAction(
  action: WalletAction,
): Promise<unknown> {
  const store = getStore();
  const { activeSession, parsedSession } = store;

  if (!activeSession || !parsedSession) {
    throw new Error('No active WalletConnect session');
  }
  if (action.mode === 'safe') {
    assertCanRequest(parsedSession, action.chain, action.method);
  } else if (!action.unsafeReason?.trim()) {
    throw new Error('Unsafe WalletConnect requests require a non-empty reason');
  }

  const requestId = crypto.randomUUID();
  const snapshot = {
    requestId,
    targetChain: action.chain.caip2,
    routeChain: action.routeChain.caip2,
    method: action.method,
    params: action.params,
    mode: action.mode,
    unsafeReason: action.unsafeReason,
    ...(action.mode === 'unsafe'
      ? {
          proposal: store.activeProposal,
          sdkMethodValidationNote:
            'Routing through an approved account chain cannot bypass SignClient SDK method validation.',
        }
      : {}),
    session: parsedSession,
  };

  store.addPendingRequest(requestId);
  store.appendEvent({
    source: 'request',
    type: `${action.method}:pending`,
    payload: snapshot,
  });

  try {
    const result = await getSignClient().request({
      topic: activeSession.topic,
      chainId: action.routeChain.caip2,
      request: {
        method: action.method,
        params: action.params,
      },
    });
    getStore().appendEvent({
      source: 'request',
      type: `${action.method}:success`,
      payload: { ...snapshot, result },
    });
    return result;
  } catch (error) {
    getStore().appendEvent({
      source: 'request',
      type: `${action.method}:error`,
      payload: { ...snapshot, error: serializeError(error) },
    });
    await refreshRestoredState().catch((refreshError: unknown) => {
      getStore().appendEvent({
        source: 'request',
        type: `${action.method}:refresh_error`,
        payload: { ...snapshot, error: serializeError(refreshError) },
      });
    });
    throw error;
  } finally {
    getStore().removePendingRequest(requestId);
  }
}

export function requestPersonalSign(input: PersonalSignInput): Promise<unknown> {
  const parsedSession = getStore().parsedSession;
  if (!parsedSession) {
    throw new Error('No active WalletConnect session');
  }

  return requestWalletAction(
    toAction(
      input,
      'personal_sign',
      buildPersonalSignParams(
        input.message,
        getApprovedAccount(parsedSession, input.chain),
      ),
    ),
  );
}

export function requestTypedDataSign(
  input: TypedDataSignInput,
): Promise<unknown> {
  const parsedSession = getStore().parsedSession;
  if (!parsedSession) {
    throw new Error('No active WalletConnect session');
  }

  return requestWalletAction(
    toAction(
      input,
      'eth_signTypedData_v4',
      buildTypedDataParams(
        getApprovedAccount(parsedSession, input.chain),
        input.chain,
      ),
    ),
  );
}

export function requestNativeTransfer(
  input: NativeTransferInput,
): Promise<unknown> {
  const parsedSession = getStore().parsedSession;
  if (!parsedSession) {
    throw new Error('No active WalletConnect session');
  }

  return requestWalletAction(
    toAction(input, 'eth_sendTransaction', [
      buildNativeTransaction(
        getApprovedAccount(parsedSession, input.chain),
        input.to,
        input.amount,
      ),
    ]),
  );
}

export function requestErc20Transfer(
  input: Erc20TransferInput,
): Promise<unknown> {
  const parsedSession = getStore().parsedSession;
  if (!parsedSession) {
    throw new Error('No active WalletConnect session');
  }

  return requestWalletAction(
    toAction(input, 'eth_sendTransaction', [
      buildErc20Transaction(
        getApprovedAccount(parsedSession, input.chain),
        input.token,
        input.recipient,
        input.amount,
        input.decimals,
      ),
    ]),
  );
}

export function requestSwitchChain(
  input: BaseWalletActionInput,
): Promise<unknown> {
  return requestWalletAction(
    toAction(
      input,
      'wallet_switchEthereumChain',
      buildSwitchChainParams(input.chain),
      getRouteChain(input),
    ),
  );
}

export async function requestAddChain(
  input: BaseWalletActionInput,
): Promise<unknown> {
  const result = await requestWalletAction(
    toAction(
      input,
      'wallet_addEthereumChain',
      buildAddChainParams(input.chain),
      getRouteChain(input),
    ),
  );

  await refreshRestoredState();
  getStore().appendEvent({
    source: 'request',
    type: 'wallet_addEthereumChain:session_snapshot',
    payload: getStore().parsedSession,
  });
  return result;
}

export function requestGetPermissions(
  input: PermissionsInput,
): Promise<unknown> {
  return requestWalletAction(
    toAction(input, 'wallet_getPermissions', input.params ?? []),
  );
}

export function requestPermissions(input: PermissionsInput): Promise<unknown> {
  return requestWalletAction(
    toAction(
      input,
      'wallet_requestPermissions',
      input.params ?? [{ eth_accounts: {} }],
    ),
  );
}

export function requestCapabilities(input: PermissionsInput): Promise<unknown> {
  return requestWalletAction(
    toAction(input, 'wallet_getCapabilities', input.params ?? []),
  );
}
