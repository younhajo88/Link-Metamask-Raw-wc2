import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { ProfilePanel } from './ProfilePanel';

describe('ProfilePanel', () => {
  beforeEach(() => {
    useDiagnosticsStore.getState().reset();
    useDiagnosticsStore.setState({ profileId: 'mainnet-only-required' });
  });

  it('shows optional namespaces when the optional profile is selected', () => {
    render(<ProfilePanel />);

    fireEvent.change(screen.getByLabelText('Profile'), {
      target: { value: 'mainnet-required-testnets-optional' },
    });

    expect(screen.getByText(/"requiredNamespaces"/)).toBeInTheDocument();
    expect(screen.getByText(/"optionalNamespaces"/)).toBeInTheDocument();
  });

  it('copies the displayed proposal JSON', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<ProfilePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy proposal JSON' }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('"requiredNamespaces"'),
    );
  });
});
