import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { StatusHeader } from './StatusHeader';

describe('StatusHeader', () => {
  beforeEach(() => {
    useDiagnosticsStore.getState().reset();
  });

  it('announces the current status and displays diagnostic summary fields', () => {
    useDiagnosticsStore.setState({
      status: 'connected',
      profileId: 'single-target-required',
      targetChainKey: 'sepolia',
      parsedSession: {
        topic: '1234567890abcdef',
        expiry: 2_000_000_000,
        peerIcons: [],
        approvedChains: [],
        approvedAccounts: {},
        approvedMethods: [],
        approvedEvents: [],
        raw: {},
      },
      restoredFromStorage: true,
      events: [
        {
          id: 'event-1',
          at: '2026-05-31T00:00:00.000Z',
          source: 'signClient',
          type: 'session_connect',
          summary: 'Wallet connected',
        },
      ],
      lastError: 'Example failure',
    });

    render(<StatusHeader />);

    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.getByText('single-target-required')).toBeInTheDocument();
    expect(screen.getByText('Sepolia')).toBeInTheDocument();
    expect(screen.getByText('123456...def')).toBeInTheDocument();
    expect(screen.getByText('Wallet connected')).toBeInTheDocument();
    expect(screen.getByText('Example failure')).toBeInTheDocument();
    expect(screen.getByText('yes')).toBeInTheDocument();
    expect(screen.getByText(/2033/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
