import { beforeEach, describe, expect, it, vi } from 'vitest';

const signClientMocks = vi.hoisted(() => ({
  init: vi.fn(),
}));

vi.mock('@walletconnect/sign-client', () => ({
  default: {
    init: signClientMocks.init,
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createClient() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    pairing: {
      getAll: vi.fn(() => []),
    },
    ping: vi.fn(),
    session: {
      get: vi.fn(),
      getAll: vi.fn(() => []),
      keys: [] as string[],
    },
  };
}

describe('connectWithProfile', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_WC_PROJECT_ID', 'test-project-id');
    signClientMocks.init.mockReset();
  });

  it('rejects a duplicate connect started before the first call marks its status', async () => {
    const client = createClient();
    const approval = deferred<never>();
    client.connect.mockResolvedValue({
      uri: 'wc:abcdefghijk@2?relay-protocol=irn',
      approval: () => approval.promise,
    });
    signClientMocks.init.mockResolvedValue(client);
    const { connectWithProfile, initializeSignClient } = await import(
      './signClient'
    );

    await initializeSignClient();
    const firstConnect = connectWithProfile(
      'mainnet-only-required',
      'mainnet',
    );
    const duplicateConnect = connectWithProfile(
      'mainnet-only-required',
      'mainnet',
    );

    await expect(duplicateConnect).rejects.toThrow(
      'WalletConnect connection is already in progress',
    );
    expect(client.connect).toHaveBeenCalledTimes(1);
    approval.reject(new Error('cancel test approval'));
    await expect(firstConnect).rejects.toThrow('cancel test approval');
  });

  it('keeps the URI-ready status while waiting for approval', async () => {
    const client = createClient();
    const approval = deferred<never>();
    client.connect.mockResolvedValue({
      uri: 'wc:abcdefghijk@2?relay-protocol=irn',
      approval: () => approval.promise,
    });
    signClientMocks.init.mockResolvedValue(client);
    const { connectWithProfile, initializeSignClient } = await import(
      './signClient'
    );
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    const connect = connectWithProfile('mainnet-only-required', 'mainnet');
    await vi.waitFor(() => {
      expect(useDiagnosticsStore.getState().uri).toBe(
        'wc:abcdefghijk@2?relay-protocol=irn',
      );
    });

    expect(useDiagnosticsStore.getState().status).toBe('pairing_uri_ready');
    approval.reject(new Error('cancel test approval'));
    await expect(connect).rejects.toThrow('cancel test approval');
  });

  it('stores the active proposal snapshot when connecting', async () => {
    const client = createClient();
    const approval = deferred<never>();
    client.connect.mockResolvedValue({
      uri: 'wc:abcdefghijk@2?relay-protocol=irn',
      approval: () => approval.promise,
    });
    signClientMocks.init.mockResolvedValue(client);
    const { connectWithProfile, initializeSignClient } = await import(
      './signClient'
    );
    const { buildNamespaceProposal } = await import('./namespaces');
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    const connect = connectWithProfile('mainnet-only-required', 'mainnet');
    await vi.waitFor(() => {
      expect(useDiagnosticsStore.getState().activeProposal).toEqual(
        buildNamespaceProposal('mainnet-only-required', 'mainnet'),
      );
    });

    approval.reject(new Error('cancel test approval'));
    await expect(connect).rejects.toThrow('cancel test approval');
  });

  it('sets an error state before rejecting a missing project ID', async () => {
    vi.stubEnv('VITE_WC_PROJECT_ID', '');
    const { initializeSignClient } = await import('./signClient');
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await expect(initializeSignClient()).rejects.toThrow(
      'Missing VITE_WC_PROJECT_ID',
    );
    expect(useDiagnosticsStore.getState()).toMatchObject({
      lastError: 'Missing VITE_WC_PROJECT_ID',
      status: 'error',
    });
  });

  it('does not clear a replacement session when disconnect completion races it', async () => {
    const client = createClient();
    const disconnect = deferred<void>();
    client.disconnect.mockReturnValue(disconnect.promise);
    signClientMocks.init.mockResolvedValue(client);
    const { disconnectActiveSession, initializeSignClient } = await import(
      './signClient'
    );
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );
    const oldSession = { topic: 'old-topic', expiry: 2_000_000_000 };
    const replacementSession = {
      topic: 'replacement-topic',
      expiry: 2_000_000_000,
    };

    await initializeSignClient();
    useDiagnosticsStore.getState().setActiveSession(oldSession as never);
    const disconnecting = disconnectActiveSession();
    useDiagnosticsStore
      .getState()
      .setActiveSession(replacementSession as never);
    useDiagnosticsStore.getState().setStatus('connected');
    client.session.keys.push('replacement-topic');
    client.session.get.mockReturnValue(replacementSession);
    disconnect.resolve();
    await disconnecting;

    expect(useDiagnosticsStore.getState().activeSession).toMatchObject(
      replacementSession,
    );
    expect(useDiagnosticsStore.getState().status).toBe('connected');
  });

  it('downgrades a stale active session after a failed ping refresh', async () => {
    const client = createClient();
    client.ping.mockRejectedValue(new Error('stale topic'));
    signClientMocks.init.mockResolvedValue(client);
    const { initializeSignClient, pingActiveSession } = await import(
      './signClient'
    );
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    useDiagnosticsStore
      .getState()
      .setActiveSession({
        topic: 'stale-topic',
        expiry: 2_000_000_000,
      } as never);
    useDiagnosticsStore.getState().setStatus('connected');

    await expect(pingActiveSession()).rejects.toThrow('stale topic');
    expect(useDiagnosticsStore.getState().activeSession).toBeUndefined();
    expect(useDiagnosticsStore.getState().status).toBe('disconnected');
  });
});
