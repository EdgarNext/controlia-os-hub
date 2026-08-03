import test from "node:test";
import assert from "node:assert/strict";
import { formatReportDocumentName, formatReportOperatorName, formatReportStationName } from "./report-presentation";

test("report presentation uses business labels and safe fallbacks", () => {
  assert.equal(formatReportOperatorName(null), "Operador no identificado");
  assert.equal(formatReportStationName({ role: "counter_station" }), "Terminal de caja");
  assert.equal(formatReportDocumentName("RP-0001", "12345678-technical"), "RP-0001");
  assert.equal(formatReportDocumentName(null, "12345678-technical"), "Documento 12345678");
});
