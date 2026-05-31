import { useMemo, useState } from 'react';

import { downloadExperimentExport } from '../diagnostics/exportResult';
import {
  sanitizeDiagnosticPayload,
  type DiagnosticEventSource,
} from '../diagnostics/eventLog';
import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { CHAINS } from '../walletconnect/chains';
import { buildPermissionMatrix } from '../walletconnect/session';

const SOURCES: DiagnosticEventSource[] = [
  'ui',
  'signClient',
  'request',
  'page',
  'storage',
];

export function EventTimeline() {
  const {
    profileId,
    targetChainKey,
    activeProposal,
    parsedSession,
    sessions,
    sessionBefore,
    sessionAfter,
    events,
    clearEvents,
  } = useDiagnosticsStore();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [notes, setNotes] = useState('');
  const [includeSensitiveValues, setIncludeSensitiveValues] = useState(false);
  const eventTypes = useMemo(
    () => [...new Set(events.map((event) => event.type))].sort(),
    [events],
  );
  const filteredEvents = useMemo(
    () =>
      [...events]
        .filter(
          (event) =>
            (sourceFilter === 'all' || event.source === sourceFilter) &&
            (typeFilter === 'all' || event.type === typeFilter),
        )
        .reverse(),
    [events, sourceFilter, typeFilter],
  );

  function exportDiagnostics() {
    const permissionMatrix = parsedSession
      ? buildPermissionMatrix(parsedSession)
      : [];
    const exportInput = {
      profile: profileId,
      wallet: parsedSession?.peerName ?? 'Unknown wallet',
      browser: navigator.userAgent,
      targetChain: CHAINS[targetChainKey].caip2,
      proposal: activeProposal,
      sessions,
      sessionBefore,
      sessionAfter,
      permissionMatrix,
      events,
      notes,
    };

    downloadExperimentExport(exportInput, { includeSensitiveValues });
  }

  return (
    <section aria-labelledby="event-timeline-title">
      <h2 id="event-timeline-title">Event timeline</h2>

      <label>
        Source
        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
        >
          <option value="all">All sources</option>
          {SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </label>

      <label>
        Type
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="all">All types</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={clearEvents}>
        Clear events
      </button>

      {filteredEvents.length > 0 ? (
        filteredEvents.map((event) => (
          <article key={event.id}>
            <time dateTime={event.at}>{event.at}</time>
            <p>
              <strong>{event.source}</strong> <code>{event.type}</code>
            </p>
            <p>{sanitizeDiagnosticPayload(event.summary) as string}</p>
            {event.payload !== undefined ? (
              <details>
                <summary>View payload</summary>
                <pre style={{ overflowX: 'auto' }}>
                  <code>
                    {JSON.stringify(sanitizeDiagnosticPayload(event.payload), null, 2)}
                  </code>
                </pre>
              </details>
            ) : null}
          </article>
        ))
      ) : (
        <p>No matching events</p>
      )}

      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={includeSensitiveValues}
          onChange={(event) => setIncludeSensitiveValues(event.target.checked)}
        />
        Include sensitive values
      </label>
      <button type="button" onClick={exportDiagnostics}>
        Export diagnostics
      </button>
    </section>
  );
}
