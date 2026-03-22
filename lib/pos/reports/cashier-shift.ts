import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PosCashierShiftReportData, PosReportsFilters } from "@/types/pos-reports";
import { normalizePosReportsFilters, type NormalizedPosReportsFilters } from "./filters";
import { buildPosCashierShiftReportData } from "./cashier-shift-mappers";

type GetPosCashierShiftReportInput = {
  tenantId: string;
  filters: PosReportsFilters;
};

type CashShiftSourceRow = {
  id: string;
  kiosk_id: string;
  opened_by_pos_user_id: string;
  closed_by_pos_user_id: string | null;
  status: "open" | "closed" | "canceled";
  opening_float_cents: number;
  declared_cash_cents: number | null;
  opened_at: string;
  closed_at: string | null;
};

type KioskSourceRow = {
  id: string;
  number: number | string;
  name: string | null;
};

type PosUserSourceRow = {
  id: string;
  name: string;
};

function parseIntegerLike(value: number | string, fieldName: string): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${fieldName} must be a finite number.`);
    }

    return value;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be numeric.`);
  }

  return parsed;
}

function buildOpenedAtRange(filters: NormalizedPosReportsFilters) {
  const endExclusive = new Date(`${filters.date_to}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  return {
    startIso: `${filters.date_from}T00:00:00.000Z`,
    endExclusiveIso: endExclusive.toISOString(),
  };
}

async function listCashShifts(
  tenantId: string,
  filters: NormalizedPosReportsFilters,
): Promise<
  Array<{
    id: string;
    kiosk_id: string;
    kiosk_label: string;
    opened_by_pos_user_id: string;
    closed_by_pos_user_id: string | null;
    opened_by_pos_user_name: string;
    closed_by_pos_user_name: string | null;
    status: "open" | "closed" | "canceled";
    opening_float_cents: number;
    declared_cash_cents: number | null;
    opened_at: string;
    closed_at: string | null;
  }>
> {
  const supabase = await getSupabaseServerClient();
  const { startIso, endExclusiveIso } = buildOpenedAtRange(filters);

  // Reporting policy for the first cash_shift-based report:
  // a shift belongs to the selected window if its opening timestamp falls in range.
  // Closed shifts may close later; they are still part of the window that opened them.
  const [{ data: shiftsData, error: shiftsError }, { data: kiosksData, error: kiosksError }, { data: posUsersData, error: posUsersError }] =
    await Promise.all([
      supabase
        .from("cash_shifts")
        .select(
          "id, kiosk_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, declared_cash_cents, opened_at, closed_at",
        )
        .eq("tenant_id", tenantId)
        .gte("opened_at", startIso)
        .lt("opened_at", endExclusiveIso)
        .order("opened_at", { ascending: false }),
      supabase
        .from("kiosks")
        .select("id, number, name")
        .eq("tenant_id", tenantId),
      supabase
        .from("pos_users")
        .select("id, name")
        .eq("tenant_id", tenantId),
    ]);

  if (shiftsError) {
    throw new Error(
      `Unable to load cash shifts for cashier-shift report: ${shiftsError.message}`,
    );
  }

  if (kiosksError) {
    throw new Error(`Unable to load kiosks for cashier-shift report: ${kiosksError.message}`);
  }

  if (posUsersError) {
    throw new Error(`Unable to load POS users for cashier-shift report: ${posUsersError.message}`);
  }

  const kioskById = new Map(
    ((kiosksData ?? []) as KioskSourceRow[]).map((row) => [
      row.id,
      row.name?.trim() ? row.name : `Kiosco ${parseIntegerLike(row.number, "kiosks.number")}`,
    ]),
  );
  const posUserById = new Map(
    ((posUsersData ?? []) as PosUserSourceRow[]).map((row) => [row.id, row.name.trim() || row.id]),
  );

  return ((shiftsData ?? []) as CashShiftSourceRow[]).map((row) => ({
    id: row.id,
    kiosk_id: row.kiosk_id,
    kiosk_label: kioskById.get(row.kiosk_id) ?? "Kiosco sin nombre",
    opened_by_pos_user_id: row.opened_by_pos_user_id,
    closed_by_pos_user_id: row.closed_by_pos_user_id,
    opened_by_pos_user_name:
      posUserById.get(row.opened_by_pos_user_id) ?? row.opened_by_pos_user_id,
    closed_by_pos_user_name: row.closed_by_pos_user_id
      ? (posUserById.get(row.closed_by_pos_user_id) ?? row.closed_by_pos_user_id)
      : null,
    status: row.status,
    opening_float_cents: row.opening_float_cents,
    declared_cash_cents: row.declared_cash_cents,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
  }));
}

export async function getPosCashierShiftReport(
  input: GetPosCashierShiftReportInput,
): Promise<PosCashierShiftReportData> {
  const normalizedFilters = normalizePosReportsFilters(input.filters);
  const cashShifts = await listCashShifts(input.tenantId, normalizedFilters);

  return buildPosCashierShiftReportData({
    filters: normalizedFilters,
    cashShifts,
  });
}
