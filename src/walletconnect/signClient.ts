import SignClient from '@walletconnect/sign-client';
import type { SignClientTypes, SessionTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import type { ChainKey } from './chains';
import {
  buildNamespaceProposal,
  type NamespaceProfileId,
} from './namespaces';

let signClient: SignClient | undefined;
let signClientPromise: Promise<SignClient> | undefined;
let connectPromise: Promise<SessionTypes.Struct> | undefined;
let disconnectPromise: Promise<void> | undefined;

const getStore = () => useDiagnosticsStore.getState();

const serializeError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };

function getSession(topic: string): SessionTypes.Struct | undefined {
  const client = getSignClient();

  return client.session.keys.includes(topic)
    ? client.session.get(topic)
    : undefined;
}

function refreshActiveSession(topic?: string): void {
  const activeSession = getStore().activeSession;

  if (!activeSession || (topic && activeSession.topic !== topic)) {
    return;
  }

  const refreshedSession = getSession(activeSession.topic);
  getStore().setActiveSession(refreshedSession);
  if (!refreshedSession) {
    getStore().setActiveProposal(undefined);
    getStore().setUri(undefined);
    getStore().setStatus('disconnected');
  }
}

function appendSignClientEvent(
  type: string,
  payload: unknown,
  summary = type,
): void {
  getStore().appendEvent({ source: 'signClient', type, summary, payload });
}

function refreshAfterSessionEvent(topic?: string): void {
  refreshActiveSession(topic);
  refreshRestoredStateAfterSubscription();
}

function refreshRestoredStateAfterSubscription(): void {
  void refreshRestoredState().catch((error: unknown) => {
    appendSignClientEvent('refresh_error', { error: serializeError(error) });
  });
}

function registerSubscriptions(client: SignClient): void {
  client.on('session_update', (event) => {
    appendSignClientEvent('session_update', event);
    refreshAfterSessionEvent(event.topic);
  });
  client.on('session_event', (event) => {
    appendSignClientEvent('session_event', event);
    refreshAfterSessionEvent(event.topic);
  });
  client.on('session_delete', (event) => {
    appendSignClientEvent('session_delete', event);
    if (getStore().activeSession?.topic === event.topic) {
      getStore().setActiveSession(undefined);
      getStore().setActiveProposal(undefined);
      getStore().setUri(undefined);
      getStore().setStatus(disconnectPromise ? 'disconnecting' : 'disconnected');
    }
    refreshRestoredStateAfterSubscription();
  });
  client.on('session_expire', (event) => {
    appendSignClientEvent('session_expire', event);
    if (getStore().activeSession?.topic === event.topic) {
      getStore().setActiveSession(undefined);
      getStore().setActiveProposal(undefined);
      getStore().setUri(undefined);
      getStore().setStatus(disconnectPromise ? 'disconnecting' : 'expired');
    }
    refreshRestoredStateAfterSubscription();
  });
  client.on('session_extend', (event) => {
    appendSignClientEvent('session_extend', event);
    refreshAfterSessionEvent(event.topic);
  });
  client.on('session_ping', (event) => {
    appendSignClientEvent('session_ping', event);
    refreshAfterSessionEvent(event.topic);
  });
  client.on('proposal_expire', (event) => {
    appendSignClientEvent('proposal_expire', event);
    getStore().setActiveProposal(undefined);
    getStore().setUri(undefined);
    if (
      getStore().status === 'pairing_uri_ready' ||
      getStore().status === 'approval_pending'
    ) {
      getStore().setStatus('expired');
    }
  });
}

export async function initializeSignClient(): Promise<SignClient> {
  if (signClient) {
    return signClient;
  }
  if (signClientPromise) {
    return signClientPromise;
  }

  const projectId = import.meta.env.VITE_WC_PROJECT_ID?.trim();
  if (!projectId) {
    const message = 'Missing VITE_WC_PROJECT_ID';
    getStore().setLastError(message);
    getStore().setStatus('error');
    throw new Error(message);
  }

  getStore().setStatus('sign_client_initializing');
  getStore().setLastError(undefined);

  signClientPromise = SignClient.init({
    projectId,
    metadata: {
      name: 'Raw WalletConnect v2 Diagnostics',
      description: 'WalletConnect v2 namespace diagnostics',
      url: window.location.origin,
      icons: [`${window.location.origin}/icon.png`],
    },
  })
    .then(async (client) => {
      signClient = client;
      registerSubscriptions(client);
      await refreshRestoredState();
      getStore().setStatus(getStore().activeSession ? 'connected' : 'idle');
      return client;
    })
    .catch((error: unknown) => {
      signClient = undefined;
      signClientPromise = undefined;
      getStore().setLastError(
        error instanceof Error ? error.message : String(error),
      );
      getStore().setStatus('error');
      throw error;
    });

  return signClientPromise;
}

export function getSignClient(): SignClient {
  if (!signClient) {
    throw new Error('SignClient has not been initialized');
  }

  return signClient;
}

async function connectWithProfileOnce(
  profileId: NamespaceProfileId,
  targetChainKey: ChainKey,
): Promise<SessionTypes.Struct> {
  const store = getStore();
  if (
    store.status === 'sign_client_initializing' ||
    store.status === 'pairing_uri_ready' ||
    store.status === 'approval_pending'
  ) {
    throw new Error('WalletConnect connection is already in progress');
  }

  const client = await initializeSignClient();
  const proposal = buildNamespaceProposal(profileId, targetChainKey);

  store.setProfileId(profileId);
  store.setTargetChainKey(targetChainKey);
  store.setUri(undefined);
  store.setActiveProposal(proposal);
  store.setLastError(undefined);
  store.appendEvent({
    source: 'ui',
    type: 'connect_started',
    payload: proposal,
  });
  store.setStatus('approval_pending');

  try {
    const { uri, approval } = await client.connect(proposal);
    getStore().setUri(uri);
    getStore().setStatus('pairing_uri_ready');
    appendSignClientEvent('pairing_uri_ready', { uri });
    const approvalPromise = approval();
    getStore().setStatus('approval_pending');
    const session = await approvalPromise;
    getStore().setActiveSession(session);
    getStore().setUri(undefined);
    getStore().setStatus('connected');
    appendSignClientEvent('session_approved', session);
    await refreshRestoredState();
    return session;
  } catch (error) {
    getStore().setUri(undefined);
    getStore().setActiveProposal(undefined);
    getStore().setLastError(
      error instanceof Error ? error.message : String(error),
    );
    getStore().setStatus('error');
    appendSignClientEvent('connect_error', serializeError(error));
    throw error;
  }
}

export async function connectWithProfile(
  profileId: NamespaceProfileId,
  targetChainKey: ChainKey,
): Promise<SessionTypes.Struct> {
  if (disconnectPromise || getStore().status === 'disconnecting') {
    throw new Error('WalletConnect disconnect is already in progress');
  }
  if (connectPromise) {
    throw new Error('WalletConnect connection is already in progress');
  }

  const pendingConnect = connectWithProfileOnce(profileId, targetChainKey);
  connectPromise = pendingConnect;

  try {
    return await pendingConnect;
  } finally {
    if (connectPromise === pendingConnect) {
      connectPromise = undefined;
    }
  }
}

async function disconnectActiveSessionOnce(): Promise<void> {
  const session = getStore().activeSession;
  if (!session) {
    return;
  }

  getStore().setStatus('disconnecting');
  try {
    await getSignClient().disconnect({
      topic: session.topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
    const activeSession = getStore().activeSession;
    if (!activeSession || activeSession.topic === session.topic) {
      getStore().setActiveSession(undefined);
      getStore().setActiveProposal(undefined);
      getStore().setUri(undefined);
      getStore().setStatus('disconnected');
    }
  } catch (error) {
    if (getStore().activeSession?.topic === session.topic) {
      getStore().setStatus('connected');
    }
    throw error;
  } finally {
    await refreshRestoredState();
  }
}

export async function disconnectActiveSession(): Promise<void> {
  if (disconnectPromise) {
    return disconnectPromise;
  }

  const pendingDisconnect = disconnectActiveSessionOnce();
  disconnectPromise = pendingDisconnect;

  try {
    await pendingDisconnect;
  } finally {
    if (disconnectPromise === pendingDisconnect) {
      disconnectPromise = undefined;
    }
  }
}

export async function refreshRestoredState(): Promise<void> {
  const client = getSignClient();
  const sessions = client.session.getAll();
  const pairings = client.pairing.getAll({ active: true });

  getStore().setRestoredState(sessions, pairings);
  refreshActiveSession();
}

export function selectRestoredSession(topic: string): SessionTypes.Struct {
  const session = getSession(topic);
  if (!session) {
    throw new Error(`WalletConnect session not found: ${topic}`);
  }

  getStore().setActiveSession(session);
  getStore().setActiveProposal(undefined);
  getStore().setStatus('connected');
  return session;
}

export async function pingActiveSession(): Promise<void> {
  const session = getStore().activeSession;
  if (!session) {
    throw new Error('No active WalletConnect session');
  }

  try {
    await getSignClient().ping({ topic: session.topic });
    appendSignClientEvent('session_ping_sent', { topic: session.topic });
  } catch (error) {
    appendSignClientEvent('session_ping_error', {
      topic: session.topic,
      error: serializeError(error),
    });
    await refreshRestoredState();
    throw error;
  }
}

export type { SignClientTypes };
