export type CostingDiagnosticEventName =
  | "field-change"
  | "field-blur"
  | "mutation-enqueued"
  | "request-start"
  | "response-received"
  | "mutation-reconciled"
  | "state-updated"
  | "conflict"
  | "request-error"
  | "product-selected"
  | "product-add-request"
  | "product-add-response"
  | "editor-mounted"
  | "editor-unmounted"
  | "initial-document-changed";

export type CostingDiagnosticEvent = {
  timestamp: string;
  event: CostingDiagnosticEventName;
  field?: string;
  localValueBefore?: unknown;
  localValueAfter?: unknown;
  submittedValue?: unknown;
  requestBody?: unknown;
  requestUrl?: string;
  requestMethod?: string;
  responseStatus?: number;
  responseBody?: unknown;
  revisionBefore?: number;
  revisionSubmitted?: number;
  revisionReturned?: number;
  revisionAfter?: number;
  documentBefore?: unknown;
  documentAfter?: unknown;
  queueLength?: number;
  costingId?: string;
  productId?: string;
  patch?: unknown;
};

export const COSTING_BROWSER_DIAG_ID = "COSTING-BROWSER-DIAG-1";
export const COSTING_BROWSER_DIAG_BUILD =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "local-dev";

export function isCostingDiagnosticsEnabled(search: string) {
  return new URLSearchParams(search).get("debugCosting") === "1";
}

export function appendDiagnosticEvent(
  events: CostingDiagnosticEvent[],
  event: Omit<CostingDiagnosticEvent, "timestamp">,
) {
  return [
    ...events,
    { timestamp: new Date().toISOString(), ...event },
  ].slice(-100);
}
