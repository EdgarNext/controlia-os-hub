import test from "node:test";
import assert from "node:assert/strict";
import {
  formatRetailReportingCount,
  formatRetailReportingCurrency,
  formatRetailReportingDateTime,
  formatRetailReportingPercent,
  formatRetailReportingPeriodLabel,
  formatRetailReportingQuantity,
  formatRetailReportingTimeZoneLabel,
} from "./reporting-formatters";

test("formatea MXN desde centavos", () => {
  assert.equal(formatRetailReportingCurrency(123456), "$1,234.56");
});

test("formatea conteos y cantidades", () => {
  assert.equal(formatRetailReportingCount(12345), "12,345");
  assert.equal(formatRetailReportingQuantity(12.5), "12.50");
});

test("formatea porcentajes", () => {
  assert.equal(formatRetailReportingPercent(0.125), "12.5%");
});

test("formatea fechas en es-MX y timezone fija", () => {
  const rendered = formatRetailReportingDateTime("2026-07-14T22:21:47.194Z");
  assert.match(rendered, /\d{2}\/\d{2}\/\d{4}/);
  assert.equal(formatRetailReportingTimeZoneLabel(), "America/Mexico_City");
});

test("formatea la etiqueta del periodo", () => {
  assert.equal(formatRetailReportingPeriodLabel("2026-07-14", "2026-07-14"), "2026-07-14");
  assert.equal(formatRetailReportingPeriodLabel("2026-07-14", "2026-07-15"), "2026-07-14 -> 2026-07-15");
});
