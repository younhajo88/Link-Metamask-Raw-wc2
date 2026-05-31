import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { Panel } from './Panel';

function formatExpiry(expiry: number): string {
  return new Date(expiry * 1_000).toLocaleString();
}

export function SessionInspector() {
  const session = useDiagnosticsStore((state) => state.parsedSession);

  if (!session) {
    return (
      <Panel title="Session inspector" defaultOpen>
        <p>No active session</p>
      </Panel>
    );
  }

  return (
    <Panel title="Session inspector" defaultOpen>
      <dl>
        <dt>Peer</dt>
        <dd>{session.peerName ?? 'Unknown peer'}</dd>
        <dt>Peer URL</dt>
        <dd>{session.peerUrl ?? 'Not provided'}</dd>
        <dt>Topic</dt>
        <dd>
          <code>{session.topic}</code>
        </dd>
        <dt>Pairing topic</dt>
        <dd>
          <code>{session.pairingTopic ?? 'Not provided'}</code>
        </dd>
        <dt>Expiry</dt>
        <dd>{formatExpiry(session.expiry)}</dd>
      </dl>

      <h3>Peer icons</h3>
      {session.peerIcons.length > 0 ? (
        <ul>
          {session.peerIcons.map((icon) => (
            <li key={icon}>
              <img src={icon} alt={`${session.peerName ?? 'Peer'} icon`} />
            </li>
          ))}
        </ul>
      ) : (
        <p>None</p>
      )}

      <h3>Derived approved chains</h3>
      {session.approvedChains.length > 0 ? (
        <ul>
          {session.approvedChains.map((chain) => (
            <li key={chain}>
              <code>{chain}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p>None</p>
      )}

      <h3>Approved addresses by chain</h3>
      {Object.entries(session.approvedAccounts).length > 0 ? (
        Object.entries(session.approvedAccounts).map(([chain, addresses]) => (
          <div key={chain}>
            <h4>
              <code>{chain}</code>
            </h4>
            <ul>
              {addresses.map((address) => (
                <li key={address}>
                  <code>{address}</code>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p>None</p>
      )}

      <h3>Approved methods</h3>
      <p>{session.approvedMethods.join(', ') || 'None'}</p>
      <h3>Approved events</h3>
      <p>{session.approvedEvents.join(', ') || 'None'}</p>
      <h3>Raw session JSON</h3>
      <pre style={{ overflowX: 'auto' }}>
        <code>{JSON.stringify(session.raw, null, 2)}</code>
      </pre>
    </Panel>
  );
}
