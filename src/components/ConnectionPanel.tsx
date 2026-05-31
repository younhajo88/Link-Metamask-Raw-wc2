import { QRCodeSVG } from 'qrcode.react';

import { shortenWalletConnectUri } from '../diagnostics/eventLog';
import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { clearWalletConnectStorage } from '../storage/wcStorageDebug';
import {
  buildMetaMaskDeepLink,
  buildMetaMaskUniversalLink,
} from '../walletconnect/deeplinks';
import {
  connectWithProfile,
  disconnectActiveSession,
} from '../walletconnect/signClient';

const CONNECT_DISABLED_STATUSES = new Set([
  'sign_client_initializing',
  'pairing_uri_ready',
  'approval_pending',
  'connected',
  'disconnecting',
]);

export function ConnectionPanel() {
  const status = useDiagnosticsStore((state) => state.status);
  const profileId = useDiagnosticsStore((state) => state.profileId);
  const targetChainKey = useDiagnosticsStore((state) => state.targetChainKey);
  const uri = useDiagnosticsStore((state) => state.uri);
  const activeSession = useDiagnosticsStore((state) => state.activeSession);
  const setLastError = useDiagnosticsStore((state) => state.setLastError);

  const reportError = (error: unknown) => {
    setLastError(error instanceof Error ? error.message : String(error));
  };

  return (
    <section aria-labelledby="connection-panel-title">
      <h2 id="connection-panel-title">Connection</h2>
      <div>
        <button
          type="button"
          disabled={CONNECT_DISABLED_STATUSES.has(status)}
          onClick={() => {
            void connectWithProfile(profileId, targetChainKey).catch(reportError);
          }}
        >
          Connect
        </button>
        <button
          type="button"
          disabled={!activeSession || status === 'disconnecting'}
          onClick={() => {
            void disconnectActiveSession().catch(reportError);
          }}
        >
          Disconnect
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

      {uri ? (
        <div>
          <QRCodeSVG
            value={uri}
            size={220}
            title="WalletConnect pairing QR code"
          />
          <p>
            Pairing URI: <code>{shortenWalletConnectUri(uri)}</code>
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(uri).catch(reportError);
            }}
          >
            Copy URI
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = buildMetaMaskUniversalLink(uri);
            }}
          >
            Open MetaMask universal link
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = buildMetaMaskDeepLink(uri);
            }}
          >
            Open MetaMask deep link
          </button>
        </div>
      ) : null}
    </section>
  );
}
