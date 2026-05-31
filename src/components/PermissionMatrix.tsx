import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { getChain } from '../walletconnect/chains';
import { buildPermissionMatrix } from '../walletconnect/session';

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

export function PermissionMatrix() {
  const session = useDiagnosticsStore((state) => state.parsedSession);

  if (!session) {
    return (
      <section aria-labelledby="permission-matrix-title">
        <h2 id="permission-matrix-title">Permission matrix</h2>
        <p>No active session</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="permission-matrix-title">
      <h2 id="permission-matrix-title">Permission matrix</h2>
      <div className="permission-grid">
        {buildPermissionMatrix(session).map((permission) => {
          const chain = getChain(permission.chainKey);

          return (
            <article
              aria-label={chain.chainName}
              key={permission.chainKey}
              className="permission-card"
            >
              <h3>{chain.chainName}</h3>
              <p>
                Chain: <code>{permission.caip2}</code>
              </p>
              <p>Has account: {yesNo(permission.hasAccount)}</p>
              <p>Can sign: {yesNo(permission.canSign)}</p>
              <p>
                Can send transaction: {yesNo(permission.canSendTransaction)}
              </p>
              <p>Can switch safely: {yesNo(permission.canSwitchSafely)}</p>
              <h4>Approved addresses</h4>
              {permission.accounts.length > 0 ? (
                <ul>
                  {permission.accounts.map((account) => (
                    <li key={account}>
                      <code>{account}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>None</p>
              )}
              <h4>Notes</h4>
              {permission.notes.length > 0 ? (
                <ul>
                  {permission.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p>None</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
