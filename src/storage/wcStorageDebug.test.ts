import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { getSignClient } from '../walletconnect/signClient';
import { clearWalletConnectStorage } from './wcStorageDebug';

vi.mock('../walletconnect/signClient', () => ({
  getSignClient: vi.fn(),
}));

function createDeleteDatabaseMock() {
  const deleteDatabase = vi.fn(() => {
    const request: Partial<IDBOpenDBRequest> = {};
    queueMicrotask(() => {
      const onSuccess = request.onsuccess as ((event: Event) => void) | null;
      onSuccess?.(new Event('success'));
    });
    return request as IDBOpenDBRequest;
  });

  vi.stubGlobal('indexedDB', { deleteDatabase });
  return deleteDatabase;
}

function createClient(disconnect = vi.fn().mockResolvedValue(undefined)) {
  return {
    core: {
      storage: {
        getKeys: vi.fn().mockResolvedValue(['wc@2:client:session', 'wc_client']),
        removeItem: vi.fn().mockResolvedValue(undefined),
      },
    },
    disconnect,
    session: {
      getAll: vi.fn(() => [{ topic: 'topic-ok' }]),
    },
  };
}

describe('clearWalletConnectStorage', () => {
  beforeEach(() => {
    useDiagnosticsStore.getState().reset();
    vi.mocked(getSignClient).mockReset();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('clears SDK persistence, the WalletConnect IndexedDB database, and matching localStorage keys', async () => {
    const deleteDatabase = createDeleteDatabaseMock();
    const client = createClient();
    vi.mocked(getSignClient).mockReturnValue(client as never);
    localStorage.setItem('wc@2:legacy', 'session');
    localStorage.setItem('walletconnect-cache', 'pairing');
    localStorage.setItem('keep-me', 'value');
    const reload = vi.fn();

    await expect(
      clearWalletConnectStorage(() => true, undefined, reload),
    ).resolves.toBe(true);

    expect(client.core.storage.removeItem).toHaveBeenCalledTimes(2);
    expect(client.core.storage.removeItem).toHaveBeenCalledWith(
      'wc@2:client:session',
    );
    expect(client.core.storage.removeItem).toHaveBeenCalledWith('wc_client');
    expect(deleteDatabase).toHaveBeenCalledWith(
      'WALLET_CONNECT_V2_INDEXED_DB',
    );
    expect(localStorage.getItem('wc@2:legacy')).toBeNull();
    expect(localStorage.getItem('walletconnect-cache')).toBeNull();
    expect(localStorage.getItem('keep-me')).toBe('value');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('logs rejected disconnect topics and preserves persistence when best-effort clearing is declined', async () => {
    const deleteDatabase = createDeleteDatabaseMock();
    const disconnect = vi.fn(({ topic }: { topic: string }) =>
      topic === 'topic-failed'
        ? Promise.reject(new Error('relay unavailable'))
        : Promise.resolve(),
    );
    const client = createClient(disconnect);
    client.session.getAll.mockReturnValue([
      { topic: 'topic-ok' },
      { topic: 'topic-failed' },
    ]);
    vi.mocked(getSignClient).mockReturnValue(client as never);
    localStorage.setItem('wc@2:legacy', 'session');
    const confirmBestEffortClear = vi.fn(() => false);
    const reload = vi.fn();

    await expect(
      clearWalletConnectStorage(
        () => true,
        confirmBestEffortClear,
        reload,
      ),
    ).resolves.toBe(false);

    expect(confirmBestEffortClear).toHaveBeenCalledWith(['topic-failed']);
    expect(
      useDiagnosticsStore
        .getState()
        .events.find(({ type }) => type === 'storage_clear_disconnect_failed')
        ?.payload,
    ).toEqual({ rejectedTopics: ['topic-failed'] });
    expect(client.core.storage.getKeys).not.toHaveBeenCalled();
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(localStorage.getItem('wc@2:legacy')).toBe('session');
    expect(reload).not.toHaveBeenCalled();
  });

  it('uses IndexedDB deletion as a fallback when SDK key removal fails', async () => {
    const deleteDatabase = createDeleteDatabaseMock();
    const client = createClient();
    client.core.storage.removeItem.mockRejectedValue(
      new Error('storage transaction failed'),
    );
    vi.mocked(getSignClient).mockReturnValue(client as never);
    const reload = vi.fn();

    await expect(
      clearWalletConnectStorage(() => true, undefined, reload),
    ).resolves.toBe(true);

    expect(deleteDatabase).toHaveBeenCalledWith(
      'WALLET_CONNECT_V2_INDEXED_DB',
    );
    expect(reload).toHaveBeenCalledOnce();
  });

  it('uses IndexedDB deletion as a fallback when SDK key enumeration fails', async () => {
    const deleteDatabase = createDeleteDatabaseMock();
    const client = createClient();
    client.core.storage.getKeys.mockRejectedValue(
      new Error('storage unavailable'),
    );
    vi.mocked(getSignClient).mockReturnValue(client as never);
    const reload = vi.fn();

    await expect(
      clearWalletConnectStorage(() => true, undefined, reload),
    ).resolves.toBe(true);

    expect(deleteDatabase).toHaveBeenCalledWith(
      'WALLET_CONNECT_V2_INDEXED_DB',
    );
    expect(reload).toHaveBeenCalledOnce();
  });
});
