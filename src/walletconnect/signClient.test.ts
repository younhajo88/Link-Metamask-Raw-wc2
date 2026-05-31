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

  it('keeps the URI while waiting for approval', async () => {
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

    expect(useDiagnosticsStore.getState().status).toBe('approval_pending');
    approval.reject(new Error('cancel test approval'));
    await expect(connect).rejects.toThrow('cancel test approval');
  });

  it('records the full pairing URI and moves to approval pending while awaiting the wallet', async () => {
    const client = createClient();
    const approval = deferred<never>();
    const uri = 'wc:abcdefghijk@2?relay-protocol=irn&symKey=secret';
    const observedStatuses: string[] = [];
    client.connect.mockImplementation(async () => {
      const { useDiagnosticsStore } = await import(
        '../state/useDiagnosticsStore'
      );
      observedStatuses.push(useDiagnosticsStore.getState().status);
      return {
        uri,
        approval: () => {
          observedStatuses.push(useDiagnosticsStore.getState().status);
          return approval.promise;
        },
      };
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
      expect(useDiagnosticsStore.getState().status).toBe('approval_pending');
    });

    expect(observedStatuses).toEqual([
      'approval_pending',
      'pairing_uri_ready',
    ]);
    expect(
      useDiagnosticsStore
        .getState()
        .events.find((event) => event.type === 'pairing_uri_ready'),
    ).toMatchObject({
      source: 'signClient',
      payload: { uri },
    });
    approval.reject(new Error('cancel test approval'));
    await expect(connect).rejects.toThrow('cancel test approval');
  });

  it('clears pairing state when wallet approval rejects', async () => {
    const client = createClient();
    client.connect.mockResolvedValue({
      uri: 'wc:abcdefghijk@2?relay-protocol=irn',
      approval: () => Promise.reject(new Error('wallet rejected')),
    });
    signClientMocks.init.mockResolvedValue(client);
    const { connectWithProfile, initializeSignClient } = await import(
      './signClient'
    );
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    await expect(
      connectWithProfile('mainnet-only-required', 'mainnet'),
    ).rejects.toThrow('wallet rejected');

    expect(useDiagnosticsStore.getState()).toMatchObject({
      uri: undefined,
      activeProposal: undefined,
      status: 'error',
    });
  });

  it('clears the active proposal when client.connect rejects', async () => {
    const client = createClient();
    client.connect.mockRejectedValue(new Error('connect rejected'));
    signClientMocks.init.mockResolvedValue(client);
    const { connectWithProfile, initializeSignClient } = await import(
      './signClient'
    );
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    await expect(
      connectWithProfile('mainnet-only-required', 'mainnet'),
    ).rejects.toThrow('connect rejected');

    expect(useDiagnosticsStore.getState()).toMatchObject({
      uri: undefined,
      activeProposal: undefined,
      status: 'error',
    });
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

  it('shares an in-flight disconnect instead of starting a duplicate operation', async () => {
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

    await initializeSignClient();
    useDiagnosticsStore
      .getState()
      .setActiveSession({ topic: 'active-topic', expiry: 2_000_000_000 } as never);
    const { buildNamespaceProposal } = await import('./namespaces');
    useDiagnosticsStore
      .getState()
      .setActiveProposal(buildNamespaceProposal('mainnet-only-required', 'mainnet'));

    const firstDisconnect = disconnectActiveSession();
    const duplicateDisconnect = disconnectActiveSession();

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    disconnect.resolve();
    await Promise.all([firstDisconnect, duplicateDisconnect]);
    expect(useDiagnosticsStore.getState().activeProposal).toBeUndefined();
  });

  it('rejects connect while a disconnect is in progress', async () => {
    const client = createClient();
    const disconnect = deferred<void>();
    client.disconnect.mockReturnValue(disconnect.promise);
    signClientMocks.init.mockResolvedValue(client);
    const {
      connectWithProfile,
      disconnectActiveSession,
      initializeSignClient,
    } = await import('./signClient');
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    useDiagnosticsStore
      .getState()
      .setActiveSession({ topic: 'active-topic', expiry: 2_000_000_000 } as never);
    const disconnecting = disconnectActiveSession();

    await expect(
      connectWithProfile('mainnet-only-required', 'mainnet'),
    ).rejects.toThrow('WalletConnect disconnect is already in progress');
    expect(client.connect).not.toHaveBeenCalled();
    disconnect.resolve();
    await disconnecting;
  });

  it('stays disconnecting until an in-flight disconnect settles after session_delete', async () => {
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

    await initializeSignClient();
    useDiagnosticsStore
      .getState()
      .setActiveSession({ topic: 'active-topic', expiry: 2_000_000_000 } as never);
    const handler = client.on.mock.calls.find(
      ([name]) => name === 'session_delete',
    )?.[1];
    const disconnecting = disconnectActiveSession();

    handler({ topic: 'active-topic' });

    expect(useDiagnosticsStore.getState().status).toBe('disconnecting');
    disconnect.resolve();
    await disconnecting;
    expect(useDiagnosticsStore.getState().status).toBe('disconnected');
  });

  it('clears the active proposal when selecting a restored session', async () => {
    const client = createClient();
    const restoredSession = { topic: 'restored-topic', expiry: 2_000_000_000 };
    client.session.keys.push(restoredSession.topic);
    client.session.get.mockReturnValue(restoredSession);
    signClientMocks.init.mockResolvedValue(client);
    const { initializeSignClient, selectRestoredSession } = await import(
      './signClient'
    );
    const { buildNamespaceProposal } = await import('./namespaces');
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    useDiagnosticsStore
      .getState()
      .setActiveProposal(buildNamespaceProposal('mainnet-only-required', 'mainnet'));

    selectRestoredSession(restoredSession.topic);

    expect(useDiagnosticsStore.getState().activeProposal).toBeUndefined();
  });

  it.each([
    ['session_delete', 'disconnected'],
    ['session_expire', 'expired'],
  ])('clears the active proposal after %s', async (eventName, status) => {
    const client = createClient();
    signClientMocks.init.mockResolvedValue(client);
    const { initializeSignClient } = await import('./signClient');
    const { buildNamespaceProposal } = await import('./namespaces');
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    useDiagnosticsStore
      .getState()
      .setActiveSession({ topic: 'active-topic', expiry: 2_000_000_000 } as never);
    useDiagnosticsStore
      .getState()
      .setActiveProposal(buildNamespaceProposal('mainnet-only-required', 'mainnet'));
    const handler = client.on.mock.calls.find(([name]) => name === eventName)?.[1];

    handler({ topic: 'active-topic' });

    expect(useDiagnosticsStore.getState()).toMatchObject({
      activeProposal: undefined,
      status,
    });
  });

  it('clears pairing state after proposal_expire', async () => {
    const client = createClient();
    signClientMocks.init.mockResolvedValue(client);
    const { initializeSignClient } = await import('./signClient');
    const { buildNamespaceProposal } = await import('./namespaces');
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    useDiagnosticsStore
      .getState()
      .setActiveProposal(buildNamespaceProposal('mainnet-only-required', 'mainnet'));
    useDiagnosticsStore
      .getState()
      .setUri('wc:abcdefghijk@2?relay-protocol=irn');
    const handler = client.on.mock.calls.find(
      ([name]) => name === 'proposal_expire',
    )?.[1];

    handler({ id: 123 });

    expect(useDiagnosticsStore.getState()).toMatchObject({
      uri: undefined,
      activeProposal: undefined,
    });
  });

  it('logs subscription refresh failures without an unhandled rejection', async () => {
    const client = createClient();
    signClientMocks.init.mockResolvedValue(client);
    const { initializeSignClient } = await import('./signClient');
    const { useDiagnosticsStore } = await import(
      '../state/useDiagnosticsStore'
    );

    await initializeSignClient();
    client.pairing.getAll.mockImplementation(() => {
      throw new Error('subscription refresh failed');
    });
    const handler = client.on.mock.calls.find(
      ([name]) => name === 'session_event',
    )?.[1];

    handler({ topic: 'observed-topic' });

    await vi.waitFor(() => {
      expect(
        useDiagnosticsStore
          .getState()
          .events.find((event) => event.type === 'refresh_error'),
      ).toMatchObject({
        source: 'signClient',
        payload: {
          error: {
            name: 'Error',
            message: 'subscription refresh failed',
          },
        },
      });
    });
  });

  it('retries initialization after restored state refresh fails', async () => {
    const failedClient = createClient();
    failedClient.session.getAll.mockImplementation(() => {
      throw new Error('transient storage failure');
    });
    const recoveredClient = createClient();
    signClientMocks.init
      .mockResolvedValueOnce(failedClient)
      .mockResolvedValueOnce(recoveredClient);
    const { initializeSignClient } = await import('./signClient');

    await expect(initializeSignClient()).rejects.toThrow(
      'transient storage failure',
    );
    await expect(initializeSignClient()).resolves.toBe(recoveredClient);
    expect(signClientMocks.init).toHaveBeenCalledTimes(2);
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
    const { buildNamespaceProposal } = await import('./namespaces');
    useDiagnosticsStore
      .getState()
      .setActiveProposal(buildNamespaceProposal('mainnet-only-required', 'mainnet'));
    useDiagnosticsStore.getState().setStatus('connected');

    await expect(pingActiveSession()).rejects.toThrow('stale topic');
    expect(useDiagnosticsStore.getState().activeSession).toBeUndefined();
    expect(useDiagnosticsStore.getState().activeProposal).toBeUndefined();
    expect(useDiagnosticsStore.getState().status).toBe('disconnected');
  });
});
