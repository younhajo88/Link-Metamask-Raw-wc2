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
    const uri = 'wc:abcdefghijk@2?relay-protocol=irn&symKey=secret';
    const result = JSON.parse(
      buildExperimentExportJson(
        {
          ...input,
          notes: `Observed pairing URI: ${uri}`,
          events: [
            {
              ...input.events[0],
              summary: `Pair using ${uri}`,
            },
          ],
        },
        {
          exportedAt: '2026-05-31T12:00:00.000Z',
        },
      ),
    );

    expect(result.exportedAt).toBe('2026-05-31T12:00:00.000Z');
    expect(result.notes).toBe('Observed pairing URI: wc:[REDACTED]@2');
    expect(result.events[0].summary).toBe('Pair using wc:[REDACTED]@2');
    expect(result.events[0].payload).toEqual({
      uri: 'wc:[REDACTED]@2',
      nested: { uri: 'wc:[REDACTED]@2' },
    });
  });

  it('redacts session accounts, topics, and request params by default', () => {
    const address = '0x1111111111111111111111111111111111111111';
    const result = JSON.parse(
      buildExperimentExportJson({
        ...input,
        sessionBefore: {
          topic:
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          namespaces: { eip155: { accounts: [`eip155:1:${address}`] } },
        },
        events: [
          {
            ...input.events[0],
            type: 'personal_sign:pending',
            payload: {
              method: 'personal_sign',
              params: ['Sign this diagnostic secret', address],
            },
          },
        ],
      }),
    );

    expect(result.sessionBefore).toEqual({
      topic: '[REDACTED]',
      namespaces: { eip155: { accounts: '[REDACTED]' } },
    });
    expect(result.events[0].payload).toEqual({
      method: 'personal_sign',
      params: '[REDACTED]',
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
