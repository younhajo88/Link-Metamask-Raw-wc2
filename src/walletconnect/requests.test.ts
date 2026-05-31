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

  it('records the session baseline and post-request snapshot after success', async () => {
    const sessionAfter = { ...session, topic: 'topic-after-success' };
    vi.mocked(getSignClient).mockReturnValue({
      request: vi.fn().mockResolvedValue('0xresult'),
    } as never);
    vi.mocked(refreshRestoredState).mockImplementation(async () => {
      useDiagnosticsStore.getState().setActiveSession(sessionAfter as never);
    });
    useDiagnosticsStore.getState().setActiveSession(session as never);

    await requestWalletAction({
      chain: getChain('mainnet'),
      routeChain: getChain('mainnet'),
      method: 'personal_sign',
      params: ['secret message', '0x1111111111111111111111111111111111111111'],
      mode: 'safe',
    });

    expect(refreshRestoredState).toHaveBeenCalledOnce();
    expect(useDiagnosticsStore.getState()).toMatchObject({
      sessionBefore: session,
      sessionAfter,
    });
    expect(useDiagnosticsStore.getState().events[1].payload).toMatchObject({
      sessionBefore: session,
      sessionAfter,
    });
  });

  it('preserves a successful wallet result when its restored-state refresh fails', async () => {
    vi.mocked(getSignClient).mockReturnValue({
      request: vi.fn().mockResolvedValue('0xresult'),
    } as never);
    vi.mocked(refreshRestoredState).mockRejectedValue(
      new Error('refresh failed'),
    );
    useDiagnosticsStore.getState().setActiveSession(session as never);

    await expect(
      requestWalletAction({
        chain: getChain('mainnet'),
        routeChain: getChain('mainnet'),
        method: 'personal_sign',
        params: [],
        mode: 'safe',
      }),
    ).resolves.toBe('0xresult');

    expect(refreshRestoredState).toHaveBeenCalledOnce();
    expect(
      useDiagnosticsStore.getState().events.map(({ type }) => type),
    ).toEqual([
      'personal_sign:pending',
      'personal_sign:refresh_error',
      'personal_sign:success',
    ]);
  });

  it('records the refreshed post-request snapshot after an error', async () => {
    const sessionAfter = { ...session, topic: 'topic-after-error' };
    vi.mocked(getSignClient).mockReturnValue({
      request: vi.fn().mockRejectedValue(new Error('stale topic')),
    } as never);
    vi.mocked(refreshRestoredState).mockImplementation(async () => {
      useDiagnosticsStore.getState().setActiveSession(sessionAfter as never);
    });
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

    expect(useDiagnosticsStore.getState()).toMatchObject({
      sessionBefore: session,
      sessionAfter,
    });
    expect(useDiagnosticsStore.getState().events[1].payload).toMatchObject({
      sessionBefore: session,
      sessionAfter,
      error: { message: 'stale topic' },
    });
  });

  it('exports the parsed add-chain session after its follow-up refresh', async () => {
    const sessionAfter = {
      ...session,
      namespaces: {
        eip155: {
          ...session.namespaces.eip155,
          accounts: [
            ...session.namespaces.eip155.accounts,
            'eip155:80002:0xabc',
          ],
        },
      },
    };
    vi.mocked(getSignClient).mockReturnValue({
      request: vi.fn().mockResolvedValue(null),
    } as never);
    vi.mocked(refreshRestoredState)
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        useDiagnosticsStore.getState().setActiveSession(sessionAfter as never);
      });
    useDiagnosticsStore.getState().setActiveSession(session as never);

    await requestAddChain({
      chain: getChain('polygonAmoy'),
      mode: 'unsafe',
      unsafeReason: 'exercise adding an unapproved target chain',
    });

    expect(
      useDiagnosticsStore
        .getState()
        .events.find(
          ({ type }) => type === 'wallet_addEthereumChain:session_snapshot',
        )?.payload,
    ).toMatchObject({
      approvedAccounts: {
        'eip155:80002': ['0xabc'],
      },
    });
  });

  it('preserves add-chain success and its best session snapshot when the follow-up refresh fails', async () => {
    const sessionAfter = { ...session, topic: 'topic-after-add-chain' };
    vi.mocked(getSignClient).mockReturnValue({
      request: vi.fn().mockResolvedValue('0xresult'),
    } as never);
    vi.mocked(refreshRestoredState)
      .mockImplementationOnce(async () => {
        useDiagnosticsStore.getState().setActiveSession(sessionAfter as never);
      })
      .mockRejectedValueOnce(new Error('follow-up refresh failed'));
    useDiagnosticsStore.getState().setActiveSession(session as never);

    await expect(
      requestAddChain({
        chain: getChain('polygonAmoy'),
        mode: 'unsafe',
        unsafeReason: 'exercise adding an unapproved target chain',
      }),
    ).resolves.toBe('0xresult');

    expect(refreshRestoredState).toHaveBeenCalledTimes(2);
    expect(useDiagnosticsStore.getState()).toMatchObject({
      sessionBefore: session,
      sessionAfter,
    });
    expect(
      useDiagnosticsStore.getState().events.map(({ type }) => type),
    ).toEqual([
      'wallet_addEthereumChain:pending',
      'wallet_addEthereumChain:success',
      'wallet_addEthereumChain:refresh_error',
      'wallet_addEthereumChain:session_snapshot',
    ]);
  });
});
