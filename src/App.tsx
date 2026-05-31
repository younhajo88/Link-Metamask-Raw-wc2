import { useEffect } from 'react';

import { ConnectionPanel } from './components/ConnectionPanel';
import { EventTimeline } from './components/EventTimeline';
import { PermissionMatrix } from './components/PermissionMatrix';
import { ProfilePanel } from './components/ProfilePanel';
import { RequestLab } from './components/RequestLab';
import { SessionInspector } from './components/SessionInspector';
import { StatusHeader } from './components/StatusHeader';
import { StoragePanel } from './components/StoragePanel';
import { useDiagnosticsStore } from './state/useDiagnosticsStore';
import { appVersion } from './version';
import { initializeSignClient } from './walletconnect/signClient';

export function App() {
  const appendEvent = useDiagnosticsStore((state) => state.appendEvent);
  const setLastError = useDiagnosticsStore((state) => state.setLastError);

  useEffect(() => {
    void initializeSignClient().catch((error: unknown) => {
      setLastError(error instanceof Error ? error.message : String(error));
    });

    const logPageEvent = (type: string) => {
      appendEvent({
        source: 'page',
        type,
        payload: {
          visibilityState: document.visibilityState,
        },
      });
    };
    const onVisibilityChange = () => logPageEvent('visibilitychange');
    const onFocus = () => logPageEvent('focus');
    const onBlur = () => logPageEvent('blur');
    const onPageShow = () => logPageEvent('pageshow');
    const onBeforeUnload = () => logPageEvent('beforeunload');

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [appendEvent, setLastError]);

  return (
    <main className="app-shell">
      <h1>Raw WalletConnect v2 Diagnostics</h1>
      <p>MetaMask Mobile namespace permission experiments.</p>
      <StatusHeader />
      <ProfilePanel />
      <ConnectionPanel />
      <SessionInspector />
      <PermissionMatrix />
      <RequestLab />
      <EventTimeline />
      <StoragePanel />
      <footer className="app-footer">
        <span>Version {appVersion.version}</span>
        <span>Commit {appVersion.commit}</span>
        <span>Built {new Date(appVersion.buildTime).toLocaleString()}</span>
      </footer>
    </main>
  );
}
