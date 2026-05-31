import {
  encodeFunctionData,
  parseEther,
  parseUnits,
  stringToHex,
  toHex,
  type Address,
} from 'viem';

import type { ChainMeta } from './chains';

export const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const buildSwitchChainParams = (chain: ChainMeta) => [
  { chainId: chain.hexChainId },
];

export const buildAddChainParams = (chain: ChainMeta) => [
  {
    chainId: chain.hexChainId,
    chainName: chain.chainName,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: chain.rpcUrls,
    blockExplorerUrls: chain.blockExplorerUrls,
  },
];

export const buildPersonalSignParams = (message: string, address: string) => [
  stringToHex(message),
  address,
];

export const buildTypedData = (address: string, chain: ChainMeta) => ({
  domain: {
    name: 'Raw WalletConnect v2 Diagnostics',
    version: '1',
    chainId: chain.chainId,
  },
  primaryType: 'Diagnostic',
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
    ],
    Diagnostic: [
      { name: 'wallet', type: 'address' },
      { name: 'message', type: 'string' },
    ],
  },
  message: {
    wallet: address,
    message: 'Raw WalletConnect v2 diagnostic signature',
  },
});

export const buildTypedDataParams = (address: string, chain: ChainMeta) => [
  address,
  JSON.stringify(buildTypedData(address, chain)),
];

export const buildNativeTransaction = (
  from: string,
  to: string,
  amount: string,
) => ({
  from,
  to,
  value: toHex(parseEther(amount)),
});

export const buildErc20Transaction = (
  from: string,
  token: string,
  recipient: string,
  amount: string,
  decimals: number,
) => ({
  from,
  to: token,
  data: encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [recipient as Address, parseUnits(amount, decimals)],
  }),
});
