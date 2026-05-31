import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { CHAINS } from '../walletconnect/chains';

function shortenTopic(topic?: string): string {
  if (!topic) {
    return 'None';
  }

  return topic.length > 12 ? `${topic.slice(0, 6)}...${topic.slice(-3)}` : topic;
}

function formatExpiry(expiry?: number): string {
  return expiry ? new Date(expiry * 1_000).toISOString() : 'None';
}

export function StatusHeader() {
  const {
    status,
    profileId,
    targetChainKey,
    parsedSession,
    restoredFromStorage,
    events,
    lastError,
  } = useDiagnosticsStore();
  const latestEvent = events[events.length - 1];
  const statusMessage = `Connection status: ${status}`;

  return (
    <header>
      <h2>WalletConnect status</h2>
      <dl>
        <dt>Status</dt>
        <dd>{status}</dd>
        <dt>Profile</dt>
        <dd>{profileId}</dd>
        <dt>Target chain</dt>
        <dd>{CHAINS[targetChainKey].chainName}</dd>
        <dt>Topic</dt>
        <dd>{shortenTopic(parsedSession?.topic)}</dd>
        <dt>Expiry</dt>
        <dd>{formatExpiry(parsedSession?.expiry)}</dd>
        <dt>Restored from storage</dt>
        <dd>{restoredFromStorage ? 'yes' : 'no'}</dd>
        <dt>Latest event</dt>
        <dd>{latestEvent?.summary ?? 'None'}</dd>
        <dt>Last error</dt>
        <dd>{lastError ?? 'None'}</dd>
      </dl>
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </header>
  );
}
