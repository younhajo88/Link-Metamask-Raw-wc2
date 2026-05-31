import { describe, expect, it } from 'vitest';
import {
  createDiagnosticEvent,
  sanitizeDiagnosticPayload,
  shortenWalletConnectUri,
  type DiagnosticEventSource,
} from './eventLog';

describe('shortenWalletConnectUri', () => {
  it('keeps a recognizable prefix, suffix, and version without query values', () => {
    expect(shortenWalletConnectUri('wc:abcdefghijk@2?relay-protocol=irn')).toBe(
      'wc:abcdef...ijk@2',
    );
  });
});

describe('sanitizeDiagnosticPayload', () => {
  it('recursively sanitizes nested WalletConnect URI strings', () => {
    expect(
      sanitizeDiagnosticPayload({
        uri: 'wc:abcdefghijk@2?relay-protocol=irn',
        nested: [
          'unchanged',
          { pairing: 'wc:1234567890@2?relay-protocol=irn' },
        ],
      }),
    ).toEqual({
      uri: 'wc:[REDACTED]@2',
      nested: ['unchanged', { pairing: 'wc:[REDACTED]@2' }],
    });
  });

  it('sanitizes WalletConnect URI substrings embedded in text', () => {
    expect(
      sanitizeDiagnosticPayload(
        'Pair using wc:abcdefghijk@2?relay-protocol=irn&symKey=secret now',
      ),
    ).toBe('Pair using wc:[REDACTED]@2 now');
  });

  it('replaces cyclic references with a clear placeholder', () => {
    const payload: { uri: string; self?: unknown } = {
      uri: 'wc:abcdefghijk@2?relay-protocol=irn',
    };
    payload.self = payload;

    expect(sanitizeDiagnosticPayload(payload)).toEqual({
      uri: 'wc:[REDACTED]@2',
      self: '[Circular]',
    });
  });

  it('redacts realistic WalletConnect and wallet request secrets while keeping diagnostic context', () => {
    expect(
      sanitizeDiagnosticPayload({
        topic: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        uri: 'wc:0123456789abcdef@2?relay-protocol=irn&symKey=secret',
        method: 'eth_sendTransaction',
        chainId: 'eip155:1',
        params: [
          {
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
            data: '0xa9059cbb0000000000000000000000003333333333333333333333333333333333333333',
          },
        ],
        namespaces: {
          eip155: {
            accounts: ['eip155:1:0x1111111111111111111111111111111111111111'],
            methods: ['personal_sign'],
          },
        },
      }),
    ).toEqual({
      topic: '[REDACTED]',
      uri: 'wc:[REDACTED]@2',
      method: 'eth_sendTransaction',
      chainId: 'eip155:1',
      params: '[REDACTED]',
      namespaces: {
        eip155: {
          accounts: '[REDACTED]',
          methods: ['personal_sign'],
        },
      },
    });
  });
});

describe('createDiagnosticEvent', () => {
  it('creates a timestamped event while retaining its raw payload internally', () => {
    const uri = 'wc:abcdefghijk@2?relay-protocol=irn&symKey=secret';
    const event = createDiagnosticEvent({
      source: 'ui',
      type: 'connect_started',
      payload: { uri },
    });

    expect(event.id).toEqual(expect.any(String));
    expect(event.at).toEqual(expect.any(String));
    expect(event.source).toBe('ui');
    expect(event.type).toBe('connect_started');
    expect(event.summary).toBe('connect_started');
    expect(event.payload).toEqual({ uri });
  });

  it('supports every diagnostics source', () => {
    const sources: DiagnosticEventSource[] = [
      'ui',
      'signClient',
      'request',
      'page',
      'storage',
    ];

    expect(
      sources.map((source) =>
        createDiagnosticEvent({ source, type: 'observed' }).source,
      ),
    ).toEqual(sources);
  });

  it('retains WalletConnect URI substrings embedded in summaries internally', () => {
    const summary =
      'Pair using wc:abcdefghijk@2?relay-protocol=irn&symKey=secret';
    const event = createDiagnosticEvent({
      source: 'ui',
      type: 'pairing_uri_ready',
      summary,
    });

    expect(event.summary).toBe(summary);
  });
});
