import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { parseSession } from '../walletconnect/session';
import { SessionInspector } from './SessionInspector';

describe('SessionInspector', () => {
  beforeEach(() => {
    useDiagnosticsStore.getState().reset();
  });

  it('renders a no-session message without an active session', () => {
    render(<SessionInspector />);

    expect(screen.getByText('No active session')).toBeInTheDocument();
  });

  it('renders peer icons and keeps raw JSON horizontally scrollable', () => {
    useDiagnosticsStore.setState({
      parsedSession: parseSession({
        topic: 'topic-1',
        expiry: 2_000_000_000,
        namespaces: {
          eip155: {
            accounts: ['eip155:1:0xabc'],
            methods: ['personal_sign'],
            events: ['accountsChanged'],
          },
        },
        peer: {
          metadata: {
            name: 'MetaMask',
            icons: ['https://metamask.io/icon.png'],
          },
        },
      }),
    });

    const { container } = render(<SessionInspector />);

    expect(
      screen.getByRole('img', { name: 'MetaMask icon' }),
    ).toBeInTheDocument();
    expect(container.querySelector('pre')).toHaveStyle({
      overflowX: 'auto',
    });
  });
});
