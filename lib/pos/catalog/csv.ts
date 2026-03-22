export type ParsedCsvFile = {
  headers: string[];
  rows: string[][];
};

function normalizeLineBreaks(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  const normalized = value == null ? "" : String(value);

  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const lines = [
    headers.map((header) => escapeCsvValue(header)).join(","),
    ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

export function parseCsv(input: string): ParsedCsvFile {
  const source = normalizeLineBreaks(input).replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = false;
        continue;
      }

      currentValue += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentValue);
      currentValue = "";

      const isEmptyRow = currentRow.every((cell) => cell.trim().length === 0);
      if (!isEmptyRow) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentValue += char;
  }

  if (inQuotes) {
    throw new Error("CSV inválido: comillas sin cerrar.");
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    const isEmptyRow = currentRow.every((cell) => cell.trim().length === 0);
    if (!isEmptyRow) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    throw new Error("El archivo CSV está vacío.");
  }

  const [headers, ...dataRows] = rows;
  return {
    headers: headers.map((header) => header.trim()),
    rows: dataRows,
  };
}

export function assertCsvHeaders(actualHeaders: string[], expectedHeaders: string[]) {
  if (actualHeaders.length !== expectedHeaders.length) {
    throw new Error(`Encabezados inválidos. Se esperaba: ${expectedHeaders.join(", ")}.`);
  }

  const hasMismatch = expectedHeaders.some((header, index) => actualHeaders[index] !== header);
  if (hasMismatch) {
    throw new Error(`Encabezados inválidos. Se esperaba: ${expectedHeaders.join(", ")}.`);
  }
}

export function parseCsvBoolean(value: string, fallback = true): boolean {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (["true", "1", "yes", "si", "sí", "active", "activo"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "inactive", "inactivo"].includes(normalized)) {
    return false;
  }

  throw new Error(`Valor booleano inválido: ${value}`);
}

export function parseCsvInteger(value: string, fallback = 0): number {
  const normalized = value.trim();

  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Número inválido: ${value}`);
  }

  return Math.trunc(parsed);
}

export function parseCsvPriceToCents(value: string): number {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Precio requerido.");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Precio inválido: ${value}`);
  }

  return Math.round(parsed * 100);
}
