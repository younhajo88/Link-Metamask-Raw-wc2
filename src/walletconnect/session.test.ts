import { describe, expect, it } from 'vitest';
import { getChain } from './chains';
import {
  assertCanRequest,
  buildPermissionMatrix,
  extractChainFromAccount,
  parseSession,
} from './session';

const session = {
  topic: 'topic-1',
  expiry: 2_000_000_000,
  namespaces: {
    eip155: {
      accounts: ['eip155:1:0xabc', 'eip155:11155111:0xabc'],
      methods: ['personal_sign', 'wallet_switchEthereumChain'],
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

describe('extractChainFromAccount', () => {
  it('extracts a CAIP-2 chain from a CAIP-10 account', () => {
    expect(extractChainFromAccount('eip155:11155111:0xabc')).toBe(
      'eip155:11155111',
    );
  });

  it('ignores malformed accounts', () => {
    expect(extractChainFromAccount('eip155:1')).toBeUndefined();
  });
});

describe('parseSession', () => {
  it('derives approved chains only from CAIP-10 accounts and groups addresses', () => {
    const parsed = parseSession({
      ...session,
      namespaces: {
        eip155: {
          ...session.namespaces.eip155,
          chains: ['eip155:80002'],
          accounts: [
            ...session.namespaces.eip155.accounts,
            'eip155:1:0xdef',
            'malformed',
          ],
        },
      },
    });

    expect(parsed).toMatchObject({
      topic: 'topic-1',
      expiry: 2_000_000_000,
      peerName: 'MetaMask',
      peerUrl: 'https://metamask.io',
      peerIcons: ['https://metamask.io/icon.png'],
      approvedChains: ['eip155:1', 'eip155:11155111'],
      approvedAccounts: {
        'eip155:1': ['0xabc', '0xdef'],
        'eip155:11155111': ['0xabc'],
      },
      approvedMethods: ['personal_sign', 'wallet_switchEthereumChain'],
      approvedEvents: ['accountsChanged', 'chainChanged'],
    });
    expect(parsed.raw).toBeDefined();
  });

  it('derives EVM permissions only from the eip155 namespace', () => {
    const parsed = parseSession({
      ...session,
      namespaces: {
        eip155: {
          accounts: ['eip155:1:0xabc'],
          methods: ['personal_sign'],
          events: ['accountsChanged'],
        },
        unrelated: {
          accounts: ['eip155:80002:0xattacker'],
          methods: ['eth_sendTransaction', 'wallet_switchEthereumChain'],
          events: ['chainChanged'],
        },
      },
    });

    expect(parsed.approvedAccounts).toEqual({ 'eip155:1': ['0xabc'] });
    expect(parsed.approvedMethods).toEqual(['personal_sign']);
    expect(parsed.approvedEvents).toEqual(['accountsChanged']);
    expect(() =>
      assertCanRequest(parsed, getChain('mainnet'), 'eth_sendTransaction'),
    ).toThrow('Method not approved: eth_sendTransaction');
  });
});

describe('buildPermissionMatrix', () => {
  it('marks account and method-backed safe capabilities per supported chain', () => {
    const matrix = buildPermissionMatrix(parseSession(session));

    expect(matrix).toHaveLength(3);
    expect(matrix.find(({ chainKey }) => chainKey === 'mainnet')).toMatchObject({
      accounts: ['0xabc'],
      hasAccount: true,
      canSign: true,
      canSendTransaction: false,
      canSwitchSafely: true,
    });
    expect(matrix.find(({ chainKey }) => chainKey === 'sepolia')).toMatchObject({
      accounts: ['0xabc'],
      hasAccount: true,
      canSwitchSafely: true,
    });
    expect(
      matrix.find(({ chainKey }) => chainKey === 'polygonAmoy'),
    ).toMatchObject({
      accounts: [],
      hasAccount: false,
      canSign: false,
      canSwitchSafely: false,
    });
  });
});

describe('assertCanRequest', () => {
  it('allows approved account and method combinations', () => {
    expect(() =>
      assertCanRequest(parseSession(session), getChain('mainnet'), 'personal_sign'),
    ).not.toThrow();
  });

  it('reports a missing target-chain account before checking the method', () => {
    const parsed = parseSession(session);
    const polygonAmoy = getChain('polygonAmoy');

    expect(() =>
      assertCanRequest(parsed, polygonAmoy, 'personal_sign'),
    ).toThrow('No approved account for chain: eip155:80002');
    expect(() =>
      assertCanRequest(parsed, polygonAmoy, 'wallet_switchEthereumChain'),
    ).toThrow('No approved account for chain: eip155:80002');
  });

  it('rejects a method the session did not approve', () => {
    expect(() =>
      assertCanRequest(
        parseSession(session),
        getChain('mainnet'),
        'eth_sendTransaction',
      ),
    ).toThrow('Method not approved: eth_sendTransaction');
  });
});
