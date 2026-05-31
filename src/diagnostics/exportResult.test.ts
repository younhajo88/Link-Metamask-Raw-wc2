import { describe, expect, it, vi } from 'vitest';
import {
  buildExperimentExportJson,
  downloadExperimentExport,
} from './exportResult';

const input = {
  profile: 'mainnet-required-testnets-optional',
  wallet: 'MetaMask Mobile',
  browser: 'Chrome',
  targetChain: 'ethereum',
  permissionMatrix: [],
  events: [
    {
      id: 'event-1',
      at: '2026-05-31T00:00:00.000Z',
      source: 'ui' as const,
      type: 'pairing_uri_ready',
      summary: 'Pairing URI ready',
      payload: {
        uri: 'wc:abcdefghijk@2?relay-protocol=irn',
        nested: { uri: 'wc:1234567890@2?relay-protocol=irn' },
      },
    },
  ],
  notes: '',
};

describe('buildExperimentExportJson', () => {
  it('excludes full pairing URIs by default', () => {
    const result = JSON.parse(
      buildExperimentExportJson(input, {
        exportedAt: '2026-05-31T12:00:00.000Z',
      }),
    );

    expect(result.exportedAt).toBe('2026-05-31T12:00:00.000Z');
    expect(result.events[0].payload).toEqual({
      uri: 'wc:abcdef...ijk@2',
      nested: { uri: 'wc:123456...890@2' },
    });
  });

  it('preserves raw pairing URIs only with the explicit sensitive export option', () => {
    const result = JSON.parse(
      buildExperimentExportJson(input, {
        includeSensitiveValues: true,
        exportedAt: '2026-05-31T12:00:00.000Z',
      }),
    );

    expect(result.events[0].payload).toEqual(input.events[0].payload);
  });
});

describe('downloadExperimentExport', () => {
  it('downloads a JSON blob through a temporary anchor and revokes the URL', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:diagnostics');
    const revokeObjectURL = vi.fn();
    const createElement = vi.fn(() => ({ click, remove }));

    downloadExperimentExport(input, {
      document: { createElement },
      url: { createObjectURL, revokeObjectURL },
      filename: 'diagnostics.json',
    });

    expect(createElement).toHaveBeenCalledWith('a');
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostics');
  });
});
