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

  it('isolates proposal methods and events from defaults and other proposals', () => {
    const first = buildNamespaceProposal('mainnet-only-required', 'mainnet');
    first.requiredNamespaces.eip155.methods.push('mutated_method');
    first.requiredNamespaces.eip155.events.push('mutated_event');

    const second = buildNamespaceProposal('mainnet-only-required', 'mainnet');

    expect(DEFAULT_METHODS).not.toContain('mutated_method');
    expect(DEFAULT_EVENTS).not.toContain('mutated_event');
    expect(second.requiredNamespaces.eip155.methods).toEqual(DEFAULT_METHODS);
    expect(second.requiredNamespaces.eip155.events).toEqual(DEFAULT_EVENTS);
  });
});
