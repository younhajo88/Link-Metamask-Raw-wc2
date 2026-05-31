import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { ConnectionPanel } from './ConnectionPanel';

describe('ConnectionPanel', () => {
  beforeEach(() => {
    useDiagnosticsStore.getState().reset();
  });

  it('hides the pairing QR code until a URI exists', () => {
    const { rerender } = render(<ConnectionPanel />);

    expect(
      screen.queryByTitle('WalletConnect pairing QR code'),
    ).not.toBeInTheDocument();

    act(() => {
      useDiagnosticsStore
        .getState()
        .setUri('wc:abcdefghijk@2?relay-protocol=irn');
    });
    rerender(<ConnectionPanel />);

    expect(
      screen.getByTitle('WalletConnect pairing QR code'),
    ).toBeInTheDocument();
  });
});
