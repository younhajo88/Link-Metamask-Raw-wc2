import type { PairingTypes, SessionTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { getSignClient } from '../walletconnect/signClient';

const WALLET_CONNECT_INDEXED_DB = 'WALLET_CONNECT_V2_INDEXED_DB';

export function getWalletConnectSessions(): SessionTypes.Struct[] {
  return getSignClient().session.getAll();
}

export function getWalletConnectPairings(): PairingTypes.Struct[] {
  return getSignClient().pairing.getAll({ active: true });
}

export async function clearWalletConnectStorage(
  confirmClear: () => boolean = () =>
    window.confirm(
      'Disconnect WalletConnect sessions, clear WalletConnect storage, and reload?',
    ),
  confirmBestEffortClear: (rejectedTopics: string[]) => boolean = (
    rejectedTopics,
  ) =>
    window.confirm(
      `Could not disconnect ${rejectedTopics.length} WalletConnect session(s): ${rejectedTopics.join(
        ', ',
      )}. Clear local persistence and reload anyway?`,
    ),
  reload: () => void = () => window.location.reload(),
): Promise<boolean> {
  if (!confirmClear()) {
    return false;
  }

  const store = useDiagnosticsStore.getState();
  const client = getSignClient();
  const sessions = client.session.getAll();

  store.appendEvent({
    source: 'storage',
    type: 'storage_clear_started',
    payload: { sessionTopics: sessions.map((session) => session.topic) },
  });

  const disconnectResults = await Promise.allSettled(
    sessions.map((session) =>
      client.disconnect({
        topic: session.topic,
        reason: getSdkError('USER_DISCONNECTED'),
      }),
    ),
  );

  const rejectedTopics = sessions
    .filter((_, index) => disconnectResults[index].status === 'rejected')
    .map((session) => session.topic);

  if (rejectedTopics.length > 0) {
    store.appendEvent({
      source: 'storage',
      type: 'storage_clear_disconnect_failed',
      payload: { rejectedTopics },
    });

    if (!confirmBestEffortClear(rejectedTopics)) {
      return false;
    }
  }

  const failedStorageKeys = await clearSdkPersistence(client.core.storage);
  const indexedDbDeleted = await deleteWalletConnectIndexedDb();

  if (failedStorageKeys.length > 0 && !indexedDbDeleted) {
    store.appendEvent({
      source: 'storage',
      type: 'storage_clear_persistence_failed',
      payload: { failedStorageKeys },
    });
    throw new Error('Failed to clear WalletConnect SDK persistence');
  }

  for (const key of Object.keys(localStorage)) {
    const normalizedKey = key.toLowerCase();
    if (key.startsWith('wc@2:') || normalizedKey.includes('walletconnect')) {
      localStorage.removeItem(key);
    }
  }

  reload();
  return true;
}

async function clearSdkPersistence(
  storage: ReturnType<typeof getSignClient>['core']['storage'],
): Promise<string[]> {
  let keys: string[];

  try {
    keys = await storage.getKeys();
  } catch {
    return ['<key enumeration>'];
  }

  const results = await Promise.allSettled(
    keys.map((key) => storage.removeItem(key)),
  );

  return keys.filter((_, index) => results[index].status === 'rejected');
}

async function deleteWalletConnectIndexedDb(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') {
    return false;
  }

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;

    try {
      request = indexedDB.deleteDatabase(WALLET_CONNECT_INDEXED_DB);
    } catch {
      resolve(false);
      return;
    }

    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    // Deletion remains queued until open SDK connections close during reload.
    request.onblocked = () => resolve(true);
  });
}
