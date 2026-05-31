import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { PermissionMatrix } from './PermissionMatrix';

describe('PermissionMatrix', () => {
  beforeEach(() => {
    useDiagnosticsStore.getState().reset();
  });

  it('shows Mainnet signing as Yes and Sepolia signing as No for a Mainnet-only session', () => {
    useDiagnosticsStore.getState().setActiveSession({
      topic: 'topic-mainnet-only',
      pairingTopic: 'pairing-mainnet-only',
      expiry: 2_000_000_000,
      namespaces: {
        eip155: {
          accounts: ['eip155:1:0xabc'],
          methods: ['personal_sign'],
          events: [],
        },
      },
      peer: {
        publicKey: 'peer',
        metadata: {
          name: 'MetaMask',
          description: 'Wallet',
          url: 'https://metamask.io',
          icons: [],
        },
      },
      acknowledged: true,
      controller: 'controller',
      self: {
        publicKey: 'self',
        metadata: {
          name: 'Diagnostics',
          description: 'Diagnostics',
          url: 'https://example.com',
          icons: [],
        },
      },
      relay: { protocol: 'irn' },
      requiredNamespaces: {},
      optionalNamespaces: {},
      sessionProperties: {},
    });

    render(<PermissionMatrix />);

    expect(
      within(screen.getByRole('article', { name: 'Ethereum Mainnet' }))
        .getByText('Can sign: Yes'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Sepolia' })).getByText(
        'Can sign: No',
      ),
    ).toBeInTheDocument();
  });
});
