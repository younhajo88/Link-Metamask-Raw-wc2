import { describe, expect, it } from 'vitest';
import {
  buildMetaMaskDeepLink,
  buildMetaMaskUniversalLink,
} from './deeplinks';

describe('MetaMask deeplinks', () => {
  it('encodes the WalletConnect URI in a universal link', () => {
    expect(buildMetaMaskUniversalLink('wc:test@2?relay-protocol=irn')).toBe(
      'https://metamask.app.link/wc?uri=wc%3Atest%402%3Frelay-protocol%3Dirn',
    );
  });

  it('encodes the WalletConnect URI in a custom scheme deep link', () => {
    expect(buildMetaMaskDeepLink('wc:test@2?relay-protocol=irn')).toBe(
      'metamask://wc?uri=wc%3Atest%402%3Frelay-protocol%3Dirn',
    );
  });
});
