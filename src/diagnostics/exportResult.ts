import {
  sanitizeDiagnosticPayload,
  type DiagnosticEvent,
} from './eventLog';

export interface ExperimentExportInput {
  profile: string;
  wallet: string;
  browser: string;
  targetChain: string;
  sessionBefore?: unknown;
  sessionAfter?: unknown;
  permissionMatrix: unknown[];
  events: DiagnosticEvent[];
  notes: string;
}

export interface ExperimentExport extends ExperimentExportInput {
  exportedAt: string;
}

export interface ExperimentExportOptions {
  exportedAt?: string;
  includeSensitiveValues?: boolean;
}

interface DownloadAnchor {
  download?: string;
  href?: string;
  click(): void;
  remove(): void;
}

interface DownloadDocument {
  createElement(tagName: 'a'): DownloadAnchor;
}

interface DownloadUrl {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface DownloadExperimentExportOptions extends ExperimentExportOptions {
  document?: DownloadDocument;
  url?: DownloadUrl;
  filename?: string;
}

export function buildExperimentExport(
  input: ExperimentExportInput,
  options: ExperimentExportOptions = {},
): ExperimentExport {
  const result: ExperimentExport = {
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    ...input,
  };

  return options.includeSensitiveValues
    ? result
    : (sanitizeDiagnosticPayload(result) as ExperimentExport);
}

export function buildExperimentExportJson(
  input: ExperimentExportInput,
  options: ExperimentExportOptions = {},
): string {
  return JSON.stringify(buildExperimentExport(input, options), null, 2);
}

export function downloadExperimentExport(
  input: ExperimentExportInput,
  options: DownloadExperimentExportOptions = {},
): void {
  const documentApi: DownloadDocument = options.document ?? document;
  const urlApi = options.url ?? URL;
  const blob = new Blob([buildExperimentExportJson(input, options)], {
    type: 'application/json',
  });
  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentApi.createElement('a');

  anchor.href = objectUrl;
  anchor.download = options.filename ?? 'walletconnect-diagnostics.json';
  anchor.click();
  anchor.remove();
  urlApi.revokeObjectURL(objectUrl);
}
