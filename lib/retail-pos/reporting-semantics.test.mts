import test from "node:test";
import assert from "node:assert/strict";
import {
  getRetailReportingGlossaryTerms,
  getRetailReportingLabel,
  getRetailReportingTerm,
} from "./reporting-semantics";
import {
  formatRetailReportAuditNote,
  getRetailReportingGlossaryEntries,
  hasRetailAttentionItems,
} from "./reporting-ui";

test("el diccionario devuelve los nombres canónicos", () => {
  assert.equal(getRetailReportingLabel("collected_sales"), "Venta cobrada");
  assert.equal(getRetailReportingLabel("commercial_result"), "Resultado comercial del periodo");
  assert.equal(getRetailReportingLabel("paid_sale_cancellation"), "Anulación de venta pagada");
});

test("no existe Venta comercial neta como nombre requerido", () => {
  const labels = getRetailReportingGlossaryTerms().map((term) => term.label);
  assert.ok(!labels.includes("Venta comercial neta"));
  assert.ok(!labels.includes("Neto comercial"));
});

test("commercial_result conserva semántica visible sin exponer nombres técnicos", () => {
  const term = getRetailReportingTerm("commercial_result");
  assert.equal(term.label, "Resultado comercial del periodo");
  assert.ok(!term.description.includes("commercialNetCents"));
});

test("el glosario reutiliza el diccionario compartido", () => {
  const glossaryEntries = getRetailReportingGlossaryEntries();
  const directEntries = getRetailReportingGlossaryTerms();
  assert.deepEqual(glossaryEntries, directEntries);
});

test("el bloque de atención reconoce lista vacía", () => {
  assert.equal(hasRetailAttentionItems([]), false);
  assert.equal(
    hasRetailAttentionItems([
      {
        id: "pending-reimbursements",
        title: "Reembolsos pendientes",
        description:
          "Texto largo de validación para comprobar que el contrato permite explicaciones extensas sin truncarlas en la capa pura.",
      },
    ]),
    true,
  );
});

test("las notas técnicas de auditoría se traducen solo en la capa visual", () => {
  assert.equal(
    formatRetailReportAuditNote(
      "Las metricas de impresion se muestran solo con evidencia registrada en retail_pos_ticket_events.",
    ),
    "Las metricas de impresion solo se muestran cuando existe evidencia registrada.",
  );
  assert.equal(
    formatRetailReportAuditNote("No hay evidencia registrada de impresión de comprobantes postventa para este turno."),
    "No hay evidencia registrada de impresión de comprobantes postventa para este turno.",
  );
});
