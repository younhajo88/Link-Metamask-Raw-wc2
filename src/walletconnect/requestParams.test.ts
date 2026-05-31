import { decodeFunctionData } from 'viem';
import { describe, expect, it } from 'vitest';

import { getChain } from './chains';
import {
  ERC20_TRANSFER_ABI,
  buildAddChainParams,
  buildErc20Transaction,
  buildNativeTransaction,
  buildPersonalSignParams,
  buildSwitchChainParams,
  buildTypedData,
  buildTypedDataParams,
} from './requestParams';

describe('request parameter builders', () => {
  it('builds wallet_switchEthereumChain params with a hex chain ID', () => {
    expect(buildSwitchChainParams(getChain('sepolia'))).toEqual([
      { chainId: '0xaa36a7' },
    ]);
  });

  it('builds wallet_addEthereumChain params from chain metadata', () => {
    expect(buildAddChainParams(getChain('polygonAmoy'))).toEqual([
      {
        chainId: '0x13882',
        chainName: 'Polygon Amoy',
        nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
        rpcUrls: [expect.any(String)],
        blockExplorerUrls: ['https://amoy.polygonscan.com'],
      },
    ]);
  });

  it('builds personal_sign params as message hex followed by address', () => {
    expect(buildPersonalSignParams('hello', '0xabc')).toEqual([
      '0x68656c6c6f',
      '0xabc',
    ]);
  });

  it('builds typed data with a numeric domain chain ID', () => {
    const typedData = buildTypedData('0xabc', getChain('mainnet'));

    expect(typedData.domain.chainId).toBe(1);
    expect(buildTypedDataParams('0xabc', getChain('mainnet'))).toEqual([
      '0xabc',
      JSON.stringify(typedData),
    ]);
  });

  it('builds native transactions with parsed ether values', () => {
    expect(buildNativeTransaction('0xabc', '0xdef', '0')).toMatchObject({
      from: '0xabc',
      to: '0xdef',
      value: '0x0',
    });
  });

  it('builds ERC-20 transfer transactions with parsed token amounts', () => {
    const token = '0x1111111111111111111111111111111111111111';
    const recipient = '0x2222222222222222222222222222222222222222';
    const transaction = buildErc20Transaction(
      '0xabc',
      token,
      recipient,
      '1.5',
      6,
    );
    const decoded = decodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      data: transaction.data,
    });

    expect(transaction).toMatchObject({ from: '0xabc', to: token });
    expect(decoded.functionName).toBe('transfer');
    expect(decoded.args).toEqual([recipient, 1_500_000n]);
  });
});
