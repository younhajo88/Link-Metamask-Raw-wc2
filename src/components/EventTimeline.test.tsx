import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadExperimentExport } from '../diagnostics/exportResult';
import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { buildNamespaceProposal } from '../walletconnect/namespaces';
import { EventTimeline } from './EventTimeline';

vi.mock('../diagnostics/exportResult', () => ({
  downloadExperimentExport: vi.fn(),
}));

const events = [
  {
    id: 'event-1',
    at: '2026-05-31T00:00:00.000Z',
    source: 'ui' as const,
    type: 'connect_started',
    summary: 'Connect started',
  },
  {
    id: 'event-2',
    at: '2026-05-31T00:01:00.000Z',
    source: 'request' as const,
    type: 'request_started',
    summary: 'Request started',
    payload: { method: 'personal_sign' },
  },
  {
    id: 'event-3',
    at: '2026-05-31T00:02:00.000Z',
    source: 'request' as const,
    type: 'request_succeeded',
    summary: 'Request succeeded',
  },
];

describe('EventTimeline', () => {
  beforeEach(() => {
    vi.mocked(downloadExperimentExport).mockReset();
    useDiagnosticsStore.getState().reset();
    useDiagnosticsStore.setState({ events });
  });

  it('shows newest events first and filters by source and type', () => {
    render(<EventTimeline />);

    expect(
      screen.getAllByRole('article').map((article) => article.textContent),
    ).toEqual([
      expect.stringContaining('Request succeeded'),
      expect.stringContaining('Request started'),
      expect.stringContaining('Connect started'),
    ]);

    fireEvent.change(screen.getByLabelText('Source'), {
      target: { value: 'request' },
    });
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'request_started' },
    });

    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Request started')).toBeInTheDocument();
    expect(screen.queryByText('Request succeeded')).not.toBeInTheDocument();
    expect(screen.queryByText('Connect started')).not.toBeInTheDocument();
    expect(screen.getByText('2026-05-31T00:01:00.000Z')).toBeInTheDocument();
    fireEvent.click(screen.getByText('View payload'));
    expect(screen.getByText(/personal_sign/)).toBeInTheDocument();
  });

  it('exports the experiment snapshot with notes and the sensitive-value choice', () => {
    const proposal = buildNamespaceProposal('single-target-required', 'sepolia');
    const session = {
      topic: 'session-topic',
      expiry: 2_000_000_000,
      namespaces: {
        eip155: {
          accounts: ['eip155:1:0xabc'],
          methods: ['personal_sign'],
          events: [],
        },
      },
      peer: {
        metadata: {
          name: 'MetaMask Mobile',
        },
      },
    };

    useDiagnosticsStore.setState({
      profileId: 'single-target-required',
      targetChainKey: 'sepolia',
      activeProposal: proposal,
      sessions: [session] as never,
      activeSession: session as never,
      parsedSession: {
        topic: session.topic,
        expiry: session.expiry,
        peerName: 'MetaMask Mobile',
        peerIcons: [],
        approvedChains: ['eip155:1'],
        approvedAccounts: { 'eip155:1': ['0xabc'] },
        approvedMethods: ['personal_sign'],
        approvedEvents: [],
        raw: session,
      },
    });

    render(<EventTimeline />);

    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Mobile approval differed from the proposal.' },
    });
    fireEvent.click(screen.getByLabelText('Include sensitive values'));
    fireEvent.click(screen.getByRole('button', { name: 'Export diagnostics' }));

    expect(downloadExperimentExport).toHaveBeenCalledOnce();
    const [input, options] = vi.mocked(downloadExperimentExport).mock.calls[0];

    expect(input).toMatchObject({
      profile: 'single-target-required',
      targetChain: 'eip155:11155111',
      wallet: 'MetaMask Mobile',
      proposal,
      sessions: [session],
      sessionAfter: session,
      events,
      notes: 'Mobile approval differed from the proposal.',
    });
    expect(input.permissionMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chainKey: 'mainnet',
          hasAccount: true,
          canSign: true,
        }),
      ]),
    );
    expect(options).toEqual({ includeSensitiveValues: true });
  });

  it('clears events from the timeline', () => {
    render(<EventTimeline />);

    const button = screen.getByRole('button', { name: 'Clear events' });

    fireEvent.click(button);

    expect(screen.getByText('No matching events')).toBeInTheDocument();
  });
});
