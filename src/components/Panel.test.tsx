import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Panel } from './Panel';

describe('Panel', () => {
  it('exposes and toggles its expanded state', () => {
    render(
      <Panel title="Details" summary="Useful summary">
        <p>Panel contents</p>
      </Panel>,
    );

    const toggle = screen.getByRole('button', { name: /details/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Panel contents')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Panel contents')).toBeInTheDocument();
  });
});
