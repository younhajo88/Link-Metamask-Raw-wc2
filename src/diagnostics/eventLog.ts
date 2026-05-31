export type DiagnosticEventSource =
  | 'ui'
  | 'signClient'
  | 'request'
  | 'page'
  | 'storage';

export interface DiagnosticEvent {
  id: string;
  at: string;
  source: DiagnosticEventSource;
  type: string;
  summary: string;
  payload?: unknown;
}

export interface DiagnosticEventInput {
  source: DiagnosticEventSource;
  type: string;
  summary?: string;
  payload?: unknown;
}

export function shortenWalletConnectUri(uri: string): string {
  const match = /^wc:([^@]+)@([^?]+)/.exec(uri);

  if (!match) {
    return uri;
  }

  const [, topic, version] = match;
  const shortenedTopic =
    topic.length > 9 ? `${topic.slice(0, 6)}...${topic.slice(-3)}` : topic;

  return `wc:${shortenedTopic}@${version}`;
}

export function sanitizeDiagnosticPayload(value: unknown): unknown {
  return sanitizeValue(value, new WeakSet<object>());
}

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'account',
  'accounts',
  'address',
  'data',
  'from',
  'message',
  'pairingtopic',
  'params',
  'recipient',
  'symkey',
  'to',
  'topic',
]);

function sanitizeString(value: string): string {
  return value
    .replace(/wc:[^@\s]+@(\d+)(?:\?[^\s]*)?/g, `wc:${REDACTED}@$1`)
    .replace(/0x[a-fA-F0-9]{40}/g, REDACTED);
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  key?: string,
): unknown {
  if (key && SENSITIVE_KEYS.has(key.toLowerCase())) {
    return REDACTED;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    return value.map((nestedValue) => sanitizeValue(nestedValue, seen));
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeValue(nestedValue, seen, key),
      ]),
    );
  }

  return value;
}

export function createDiagnosticEvent(
  input: DiagnosticEventInput,
): DiagnosticEvent {
  const event: DiagnosticEvent = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    source: input.source,
    type: input.type,
    summary: input.summary ?? input.type,
  };

  if (input.payload !== undefined) {
    event.payload = input.payload;
  }

  return event;
}
