import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { requestNativeTransfer } from '../walletconnect/requests';
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

  it('allows an explicitly entered zero native amount and waits for confirmation', () => {
    render(<RequestLab />);
    chooseRequest('eth_sendTransaction');
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: '0xrecipient' },
    });
    fireEvent.change(screen.getByLabelText('Amount (ETH)'), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(screen.getByRole('heading', { name: 'Confirm request' })).toBeInTheDocument();
    expect(screen.getByText(/Chain: Ethereum Mainnet/)).toBeInTheDocument();
    expect(screen.getByText(/Asset: ETH/)).toBeInTheDocument();
    expect(screen.getByText(/Recipient: 0xrecipient/)).toBeInTheDocument();
    expect(screen.getByText(/Amount: 0/)).toBeInTheDocument();
    expect(requestNativeTransfer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and send' }));

    expect(requestNativeTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '0xrecipient',
        amount: '0',
      }),
    );
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
      target: { value: '0xrecipient' },
    });
    fireEvent.change(screen.getByLabelText('Amount (ETH)'), {
      target: { value: '1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prepare request' }));

    expect(screen.getByText(/Mainnet warning/i)).toBeInTheDocument();
    expect(screen.getByText(/real funds/i)).toBeInTheDocument();
    expect(requestNativeTransfer).not.toHaveBeenCalled();
  });
});
