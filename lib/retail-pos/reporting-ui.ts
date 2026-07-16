import { getRetailReportingGlossaryTerms, type RetailReportingTerm } from "./reporting-semantics";

export type RetailAttentionTone = "default" | "warning";

export type RetailAttentionItem = {
  id: string;
  title: string;
  description: string;
  quantity?: string | null;
  amount?: string | null;
  tone?: RetailAttentionTone;
  href?: string | null;
  linkLabel?: string | null;
  accessibleLabel?: string | null;
};

export function hasRetailAttentionItems(items: readonly RetailAttentionItem[]): boolean {
  return items.length > 0;
}

export function getRetailReportingGlossaryEntries(): RetailReportingTerm[] {
  return getRetailReportingGlossaryTerms();
}

export function formatRetailReportAuditNote(note: string): string {
  switch (note) {
    case "Las metricas de impresion se muestran solo con evidencia registrada en retail_pos_ticket_events.":
      return "Las metricas de impresion solo se muestran cuando existe evidencia registrada.";
    case "La evidencia refleja comprobantes postventa registrados en retail_pos_ticket_events.":
      return "La evidencia refleja comprobantes postventa realmente registrados para este turno.";
    default:
      return note;
  }
}
