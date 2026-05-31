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
      uri: 'wc:abcdef...ijk@2',
      nested: ['unchanged', { pairing: 'wc:123456...890@2' }],
    });
  });
});

describe('createDiagnosticEvent', () => {
  it('creates a timestamped event and sanitizes its payload by default', () => {
    const event = createDiagnosticEvent({
      source: 'ui',
      type: 'connect_started',
      payload: { uri: 'wc:abcdefghijk@2?relay-protocol=irn' },
    });

    expect(event.id).toEqual(expect.any(String));
    expect(event.at).toEqual(expect.any(String));
    expect(event.source).toBe('ui');
    expect(event.type).toBe('connect_started');
    expect(event.summary).toBe('connect_started');
    expect(event.payload).toEqual({ uri: 'wc:abcdef...ijk@2' });
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
});
