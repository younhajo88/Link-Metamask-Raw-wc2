import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { getChain } from './chains';
import { buildNamespaceProposal } from './namespaces';
import {
  requestAddChain,
  requestSwitchChain,
  requestWalletAction,
} from './requests';
import { getSignClient, refreshRestoredState } from './signClient';

vi.mock('./signClient', () => ({
  getSignClient: vi.fn(),
  refreshRestoredState: vi.fn(),
}));

const session = {
  topic: 'topic-1',
  expiry: 2_000_000_000,
  namespaces: {
    eip155: {
      accounts: ['eip155:1:0xabc'],
      methods: ['personal_sign'],
      events: ['accountsChanged', 'chainChanged'],
    },
  },
  peer: {
    metadata: {
      name: 'MetaMask',
      url: 'https://metamask.io',
      icons: ['https://metamask.io/icon.png'],
    },
  },
};

describe('requestWalletAction', () => {
  beforeEach(() => {
    useDiagnosticsStore.getState().reset();
    vi.mocked(getSignClient).mockReset();
    vi.mocked(refreshRestoredState).mockReset().mockResolvedValue(undefined);
  });

  it('includes the active proposal snapshot in unsafe request events', async () => {
    const proposal = buildNamespaceProposal(
      'mainnet-only-required',
      'mainnet',
    );
    vi.mocked(getSignClient).mockReturnValue({
      request: vi.fn().mockResolvedValue('0xresult'),
    } as never);
    useDiagnosticsStore.getState().setActiveSession(session as never);
    useDiagnosticsStore.setState({ activeProposal: proposal });

    await requestWalletAction({
      chain: getChain('mainnet'),
      routeChain: getChain('mainnet'),
      method: 'wallet_getCapabilities',
      params: [],
      mode: 'unsafe',
      unsafeReason: 'exercise wallet behavior outside approved methods',
    });

    const requestEvents = useDiagnosticsStore
      .getState()
      .events.filter(({ source }) => source === 'request');
    expect(requestEvents).toHaveLength(2);
    expect(requestEvents[0].payload).toMatchObject({ proposal });
    expect(requestEvents[1].payload).toMatchObject({ proposal });
  });

  it('routes an unsafe switch request through an approved supported chain while logging its target', async () => {
    const request = vi.fn().mockResolvedValue(null);
    vi.mocked(getSignClient).mockReturnValue({ request } as never);
    useDiagnosticsStore.getState().setActiveSession(session as never);

    await requestSwitchChain({
      chain: getChain('polygonAmoy'),
      mode: 'unsafe',
      unsafeReason: 'exercise switching to an unapproved target chain',
    });

    expect(request).toHaveBeenCalledWith({
      topic: 'topic-1',
      chainId: 'eip155:1',
      request: {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }],
      },
    });
    expect(useDiagnosticsStore.getState().events[0].payload).toMatchObject({
      routeChain: 'eip155:1',
      targetChain: 'eip155:80002',
      sdkMethodValidationNote: expect.stringContaining('cannot bypass'),
    });
  });

  it('keeps safe switch validation on the target chain', async () => {
    vi.mocked(getSignClient).mockReturnValue({
      request: vi.fn(),
    } as never);
    useDiagnosticsStore.getState().setActiveSession(session as never);

    await expect(
      requestSwitchChain({
        chain: getChain('polygonAmoy'),
      }),
    ).rejects.toThrow('No approved account for chain: eip155:80002');
  });

  it('routes an unsafe add-chain request through an approved supported chain', async () => {
    const request = vi.fn().mockResolvedValue(null);
    vi.mocked(getSignClient).mockReturnValue({ request } as never);
    useDiagnosticsStore.getState().setActiveSession(session as never);

    await requestAddChain({
      chain: getChain('polygonAmoy'),
      mode: 'unsafe',
      unsafeReason: 'exercise adding an unapproved target chain',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 'eip155:1',
        request: expect.objectContaining({
          method: 'wallet_addEthereumChain',
        }),
      }),
    );
  });

  it('refreshes restored state after a request error', async () => {
    vi.mocked(getSignClient).mockReturnValue({
      request: vi.fn().mockRejectedValue(new Error('stale topic')),
    } as never);
    useDiagnosticsStore.getState().setActiveSession(session as never);

    await expect(
      requestWalletAction({
        chain: getChain('mainnet'),
        routeChain: getChain('mainnet'),
        method: 'personal_sign',
        params: [],
        mode: 'safe',
      }),
    ).rejects.toThrow('stale topic');
    expect(refreshRestoredState).toHaveBeenCalledOnce();
  });
});
