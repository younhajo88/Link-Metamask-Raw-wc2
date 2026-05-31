import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { clearWalletConnectStorage } from '../storage/wcStorageDebug';
import {
  pingActiveSession,
  refreshRestoredState,
  selectRestoredSession,
} from '../walletconnect/signClient';

function formatExpiry(expiry: number): string {
  return new Date(expiry * 1_000).toLocaleString();
}

export function StoragePanel() {
  const restoredFromStorage = useDiagnosticsStore(
    (state) => state.restoredFromStorage,
  );
  const sessions = useDiagnosticsStore((state) => state.sessions);
  const pairings = useDiagnosticsStore((state) => state.pairings);
  const activeSession = useDiagnosticsStore((state) => state.activeSession);
  const setLastError = useDiagnosticsStore((state) => state.setLastError);

  const reportError = (error: unknown) => {
    setLastError(error instanceof Error ? error.message : String(error));
  };

  return (
    <section aria-labelledby="storage-panel-title">
      <h2 id="storage-panel-title">Storage diagnostics</h2>
      <p>Restored from storage: {restoredFromStorage ? 'Yes' : 'No'}</p>
      <div>
        <button
          type="button"
          onClick={() => {
            void refreshRestoredState().catch(reportError);
          }}
        >
          Refresh restored state
        </button>
        <button
          type="button"
          disabled={!activeSession}
          onClick={() => {
            void pingActiveSession().catch(reportError);
          }}
        >
          Ping active session
        </button>
        <button
          type="button"
          onClick={() => {
            void clearWalletConnectStorage().catch(reportError);
          }}
        >
          Clear WalletConnect storage
        </button>
      </div>

      <h3>Restored sessions</h3>
      {sessions.length > 0 ? (
        <ul>
          {sessions.map((session) => (
            <li key={session.topic}>
              <code>{session.topic}</code> expires {formatExpiry(session.expiry)}
              <button
                type="button"
                disabled={session.topic === activeSession?.topic}
                onClick={() => {
                  try {
                    selectRestoredSession(session.topic);
                  } catch (error) {
                    reportError(error);
                  }
                }}
              >
                {session.topic === activeSession?.topic
                  ? 'Selected'
                  : 'Select session'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No restored sessions</p>
      )}

      <h3>Active pairings</h3>
      {pairings.length > 0 ? (
        <ul>
          {pairings.map((pairing) => (
            <li key={pairing.topic}>
              <code>{pairing.topic}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p>No active pairings</p>
      )}
    </section>
  );
}
