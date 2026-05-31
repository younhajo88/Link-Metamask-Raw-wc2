import { CHAINS, type ChainKey } from './chains';

export type NamespaceProfileId =
  | 'mainnet-only-required'
  | 'strict-three-chains-required'
  | 'mainnet-required-testnets-optional'
  | 'single-target-required';

export const DEFAULT_METHODS = [
  'personal_sign',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
  'wallet_getPermissions',
  'wallet_requestPermissions',
  'wallet_getCapabilities',
];

export const DEFAULT_EVENTS = ['accountsChanged', 'chainChanged'];

interface Namespace {
  chains: string[];
  methods: string[];
  events: string[];
}

export interface NamespaceProposal {
  requiredNamespaces: { eip155: Namespace };
  optionalNamespaces?: { eip155: Namespace };
}

export function buildNamespaceProposal(
  profileId: NamespaceProfileId,
  target: ChainKey,
): NamespaceProposal {
  const allChains = Object.values(CHAINS).map((chain) => chain.caip2);
  const targetChain = CHAINS[target].caip2;
  const profileChains = {
    'mainnet-only-required': {
      required: [CHAINS.mainnet.caip2],
      optional: [],
    },
    'strict-three-chains-required': {
      required: allChains,
      optional: [],
    },
    'mainnet-required-testnets-optional': {
      required: [CHAINS.mainnet.caip2],
      optional: [CHAINS.sepolia.caip2, CHAINS.polygonAmoy.caip2],
    },
    'single-target-required': {
      required: [targetChain],
      optional: allChains.filter((chain) => chain !== targetChain),
    },
  }[profileId];
  const buildNamespace = (chains: string[]): Namespace => ({
    chains,
    methods: [...DEFAULT_METHODS],
    events: [...DEFAULT_EVENTS],
  });

  return {
    requiredNamespaces: {
      eip155: buildNamespace(profileChains.required),
    },
    ...(profileChains.optional.length > 0
      ? {
          optionalNamespaces: {
            eip155: buildNamespace(profileChains.optional),
          },
        }
      : {}),
  };
}
