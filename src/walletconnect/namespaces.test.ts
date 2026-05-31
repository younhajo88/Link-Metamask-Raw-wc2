import { describe, expect, it } from 'vitest';
import { CHAINS } from './chains';
import {
  DEFAULT_EVENTS,
  DEFAULT_METHODS,
  buildNamespaceProposal,
} from './namespaces';

describe('buildNamespaceProposal', () => {
  it('requires only mainnet and omits empty optional namespaces', () => {
    expect(buildNamespaceProposal('mainnet-only-required', 'sepolia')).toEqual({
      requiredNamespaces: {
        eip155: {
          chains: ['eip155:1'],
          methods: DEFAULT_METHODS,
          events: DEFAULT_EVENTS,
        },
      },
    });
  });

  it('requires all supported chains for the strict profile', () => {
    expect(
      buildNamespaceProposal('strict-three-chains-required', 'sepolia'),
    ).toEqual({
      requiredNamespaces: {
        eip155: {
          chains: Object.values(CHAINS).map((chain) => chain.caip2),
          methods: DEFAULT_METHODS,
          events: DEFAULT_EVENTS,
        },
      },
    });
  });

  it('makes testnets optional while requiring mainnet', () => {
    expect(
      buildNamespaceProposal('mainnet-required-testnets-optional', 'sepolia'),
    ).toEqual({
      requiredNamespaces: {
        eip155: {
          chains: ['eip155:1'],
          methods: DEFAULT_METHODS,
          events: DEFAULT_EVENTS,
        },
      },
      optionalNamespaces: {
        eip155: {
          chains: ['eip155:11155111', 'eip155:80002'],
          methods: DEFAULT_METHODS,
          events: DEFAULT_EVENTS,
        },
      },
    });
  });

  it('requires the selected target and makes every other chain optional', () => {
    expect(buildNamespaceProposal('single-target-required', 'sepolia')).toEqual(
      {
        requiredNamespaces: {
          eip155: {
            chains: ['eip155:11155111'],
            methods: DEFAULT_METHODS,
            events: DEFAULT_EVENTS,
          },
        },
        optionalNamespaces: {
          eip155: {
            chains: ['eip155:1', 'eip155:80002'],
            methods: DEFAULT_METHODS,
            events: DEFAULT_EVENTS,
          },
        },
      },
    );
  });
});
