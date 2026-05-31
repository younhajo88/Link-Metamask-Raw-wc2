import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import {
  requestNativeTransfer,
  requestPersonalSign,
} from '../walletconnect/requests';
import { RequestLab } from './RequestLab';

vi.mock('../walletconnect/requests', () => ({
  requestPersonalSign: vi.fn().mockResolvedValue(undefined),
  requestTypedDataSign: vi.fn().mockResolvedValue(undefined),
  requestNativeTransfer: vi.fn().mockResolvedValue(undefined),
  requestErc20Transfer: vi.fn().mockResolvedValue(undefined),
  requestSwitchChain: vi.fn().mockResolvedValue(undefined),
  requestAddChain: vi.fn().mockResolvedValue(undefined),
  requestGetPermissions: vi.fn().mockResolvedValue(undefined),
  requestPermissions: vi.fn().mockResolvedValue(undefined),
  requestCapabilities: vi.fn().mockResolvedValue(undefined),
}));

const chooseRequest = (label: string) => {
  fireEvent.change(screen.getByLabelText('Request'), {
    target: { value: label },
  });
};

const VALID_ADDRESS = '0x0000000000000000000000000000000000000001';

describe('RequestLab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagnosticsStore.getState().reset();
  });

  it('requires an explicitly entered native recipient and amount', () => {
    render(<RequestLab />);
    chooseRequest('eth_sendTransaction');

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(
      screen.getByText('Recipient and amount are required.'),
    ).toBeInTheDocument();
    expect(requestNativeTransfer).not.toHaveBeenCalled();
  });

  it('allows an explicitly entered zero native amount and waits for confirmation', async () => {
    render(<RequestLab />);
    chooseRequest('eth_sendTransaction');
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText('Amount (ETH)'), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(screen.getByRole('heading', { name: 'Confirm request' })).toBeInTheDocument();
    expect(screen.getByText(/Chain: Ethereum Mainnet/)).toBeInTheDocument();
    expect(screen.getByText(/Asset: ETH/)).toBeInTheDocument();
    expect(screen.getByText(`Recipient: ${VALID_ADDRESS}`)).toBeInTheDocument();
    expect(screen.getByText(/Amount: 0/)).toBeInTheDocument();
    expect(requestNativeTransfer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and send' }));

    await waitFor(() => {
      expect(requestNativeTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          to: VALID_ADDRESS,
          amount: '0',
        }),
      );
    });
  });

  it('requires a nonempty reason when unsafe mode is enabled', () => {
    render(<RequestLab />);
    fireEvent.click(screen.getByLabelText('Unsafe request'));

    expect(screen.getByText(/accountsChanged\(\[\]\)/)).toBeInTheDocument();
    expect(screen.getByText(/silent fail/i)).toBeInTheDocument();
    expect(screen.getByText(/wallet-specific behavior/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(
      screen.getByText('Unsafe requests require a non-empty reason.'),
    ).toBeInTheDocument();
  });

  it('adds an extra Mainnet warning before a native transfer is sent', () => {
    render(<RequestLab />);
    chooseRequest('eth_sendTransaction');
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText('Amount (ETH)'), {
      target: { value: '1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(screen.getByText(/Mainnet warning/i)).toBeInTheDocument();
    expect(screen.getByText(/real funds/i)).toBeInTheDocument();
    expect(requestNativeTransfer).not.toHaveBeenCalled();
  });

  it('rejects malformed native recipients and amounts before confirmation', () => {
    render(<RequestLab />);
    chooseRequest('eth_sendTransaction');
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: '0xrecipient' },
    });
    fireEvent.change(screen.getByLabelText('Amount (ETH)'), {
      target: { value: '-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Recipient must be a valid address.',
    );
    expect(
      screen.queryByRole('heading', { name: 'Confirm request' }),
    ).not.toBeInTheDocument();
  });

  it('rejects negative native amounts before confirmation', () => {
    render(<RequestLab />);
    chooseRequest('eth_sendTransaction');
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText('Amount (ETH)'), {
      target: { value: '-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Amount must be a non-negative decimal number.',
    );
  });

  it('rejects malformed ERC-20 fields and decimals outside sane bounds', () => {
    render(<RequestLab />);
    chooseRequest('erc20_transfer');
    fireEvent.change(screen.getByLabelText('Token contract'), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText('Amount (tokens)'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Decimals'), {
      target: { value: '256' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Decimals must be an integer between 0 and 255.',
    );
  });

  it('reports synchronous request builder errors instead of throwing', async () => {
    vi.mocked(requestNativeTransfer).mockImplementationOnce(() => {
      throw new Error('builder failed');
    });
    render(<RequestLab />);
    chooseRequest('eth_sendTransaction');
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText('Amount (ETH)'), {
      target: { value: '1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('builder failed');
  });

  it('disables preparation and confirmation while another request is pending', () => {
    render(<RequestLab />);
    chooseRequest('eth_sendTransaction');
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText('Amount (ETH)'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    act(() => {
      useDiagnosticsStore.setState({ pendingRequestIds: ['pending-request'] });
    });

    expect(screen.getByRole('button', { name: 'Prepare request' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm and send' })).toBeDisabled();
  });

  it('resets unsafe consent after preparing execution and when request or chain changes', async () => {
    render(<RequestLab />);
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByLabelText('Unsafe request'));
    fireEvent.change(screen.getByLabelText('Unsafe reason'), {
      target: { value: 'diagnostic test' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    await waitFor(() => {
      expect(requestPersonalSign).toHaveBeenCalled();
    });
    expect(screen.getByLabelText('Unsafe request')).not.toBeChecked();

    fireEvent.click(screen.getByLabelText('Unsafe request'));
    fireEvent.change(screen.getByLabelText('Unsafe reason'), {
      target: { value: 'request change' },
    });
    chooseRequest('wallet_getPermissions');
    expect(screen.getByLabelText('Unsafe request')).not.toBeChecked();

    fireEvent.click(screen.getByLabelText('Unsafe request'));
    fireEvent.change(screen.getByLabelText('Unsafe reason'), {
      target: { value: 'chain change' },
    });
    fireEvent.change(screen.getByLabelText('Chain'), {
      target: { value: 'sepolia' },
    });
    expect(screen.getByLabelText('Unsafe request')).not.toBeChecked();
  });
});
