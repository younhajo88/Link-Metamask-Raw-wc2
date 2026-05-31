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

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return value.replace(/wc:[^@\s]+@\d+(?:\?[^\s]*)?/g, (uri) =>
      shortenWalletConnectUri(uri),
    );
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
        sanitizeValue(nestedValue, seen),
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
    summary: sanitizeDiagnosticPayload(input.summary ?? input.type) as string,
  };

  if (input.payload !== undefined) {
    event.payload = sanitizeDiagnosticPayload(input.payload);
  }

  return event;
}
