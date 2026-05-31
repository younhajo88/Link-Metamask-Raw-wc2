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
  if (typeof value === 'string') {
    return value.startsWith('wc:') ? shortenWalletConnectUri(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeDiagnosticPayload);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeDiagnosticPayload(nestedValue),
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
    event.payload = sanitizeDiagnosticPayload(input.payload);
  }

  return event;
}
