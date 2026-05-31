import { describe, expect, it } from 'vitest';

import { CHAINS, CHAIN_LIST, getChain } from './chains';

describe('chains', () => {
  it('exposes the supported chains in display order', () => {
    expect(CHAIN_LIST).toEqual([
      CHAINS.mainnet,
      CHAINS.sepolia,
      CHAINS.polygonAmoy,
    ]);
  });

  it('returns Sepolia metadata', () => {
    expect(getChain('sepolia')).toMatchObject({
      caip2: 'eip155:11155111',
      chainId: 11155111,
      hexChainId: '0xaa36a7',
    });
  });

  it('uses the approved Polygon Amoy metadata', () => {
    expect(getChain('polygonAmoy')).toMatchObject({
      caip2: 'eip155:80002',
      chainId: 80002,
      hexChainId: '0x13882',
      nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
      rpcUrls: [expect.any(String)],
    });
  });
});
