export type ChainKey = 'mainnet' | 'sepolia' | 'polygonAmoy';

export interface ChainMeta {
  key: ChainKey;
  caip2: `eip155:${number}`;
  chainId: number;
  hexChainId: `0x${string}`;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const CHAINS: Record<ChainKey, ChainMeta> = {
  mainnet: {
    key: 'mainnet',
    caip2: 'eip155:1',
    chainId: 1,
    hexChainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      import.meta.env.VITE_MAINNET_RPC_URL ||
        'https://ethereum-rpc.publicnode.com',
    ],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  sepolia: {
    key: 'sepolia',
    caip2: 'eip155:11155111',
    chainId: 11155111,
    hexChainId: '0xaa36a7',
    chainName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      import.meta.env.VITE_SEPOLIA_RPC_URL ||
        'https://ethereum-sepolia-rpc.publicnode.com',
    ],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  polygonAmoy: {
    key: 'polygonAmoy',
    caip2: 'eip155:80002',
    chainId: 80002,
    hexChainId: '0x13882',
    chainName: 'Polygon Amoy',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: [
      import.meta.env.VITE_POLYGON_AMOY_RPC_URL ||
        'https://rpc-amoy.polygon.technology',
    ],
    blockExplorerUrls: ['https://amoy.polygonscan.com'],
  },
};

export const CHAIN_LIST = Object.values(CHAINS);

export const getChain = (key: ChainKey) => CHAINS[key];
