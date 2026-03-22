import { NextResponse } from "next/server";
import { authenticatePosDevice } from "@/lib/pos/device-auth";
import {
  addSimpleSalesAccountLine,
  assignSalesAccount,
  captureSalesAccountPayment,
  closeSalesAccount,
  getSalesAccountById,
  listOpenSalesAccounts,
  openSalesAccount,
  voidSalesAccountLine,
} from "@/lib/pos/accounts/runtime";

type RouteParams = {
  tenantSlug: string;
};

type RuntimeAccountsRequest =
  | {
      deviceId?: unknown;
      deviceSecret?: unknown;
      action?: unknown;
    }
  | null;

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asInteger(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }
  return fallback;
}

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const body = (await request.json()) as RuntimeAccountsRequest;

    if (!body || typeof body !== "object") {
      return badRequest("Invalid request body.");
    }

    const deviceId = asTrimmedString(body.deviceId);
    const deviceSecret = asTrimmedString(body.deviceSecret);
    const action = asTrimmedString(body.action);

    if (!deviceId) {
      return badRequest("deviceId is required.");
    }
    if (!deviceSecret) {
      return badRequest("deviceSecret is required.");
    }
    if (!action) {
      return badRequest("action is required.");
    }

    const device = await authenticatePosDevice({
      tenantSlug,
      deviceId,
      deviceSecret,
    });

    if (action === "listOpenAccounts") {
      const payload = await listOpenSalesAccounts({
        tenantId: device.tenantId,
      });
      return NextResponse.json({ ok: true, ...payload });
    }

    if (action === "openAccount") {
      const openedByPosUserId = asTrimmedString((body as Record<string, unknown>).openedByPosUserId);
      const serviceContext = asTrimmedString((body as Record<string, unknown>).serviceContext);
      if (!openedByPosUserId) {
        return badRequest("openedByPosUserId is required.");
      }
      if (
        serviceContext !== "walk_in" &&
        serviceContext !== "table_service" &&
        serviceContext !== "whatsapp_pickup"
      ) {
        return badRequest("serviceContext is invalid.");
      }

      const detail = await openSalesAccount({
        tenantId: device.tenantId,
        tenantSlug: device.tenantSlug,
        kioskId: device.kioskId,
        openedByPosUserId,
        serviceContext,
      });
      return NextResponse.json({ ok: true, detail });
    }

    if (action === "assignAccount") {
      const salesAccountId = asTrimmedString((body as Record<string, unknown>).salesAccountId);
      const assignedByPosUserId = asTrimmedString((body as Record<string, unknown>).assignedByPosUserId);
      const assignmentType = asTrimmedString((body as Record<string, unknown>).assignmentType);
      if (!salesAccountId || !assignedByPosUserId) {
        return badRequest("salesAccountId and assignedByPosUserId are required.");
      }
      if (
        assignmentType !== "walk_in" &&
        assignmentType !== "table" &&
        assignmentType !== "whatsapp"
      ) {
        return badRequest("assignmentType is invalid.");
      }

      const detail = await assignSalesAccount({
        tenantId: device.tenantId,
        tenantSlug: device.tenantSlug,
        salesAccountId,
        assignedByPosUserId,
        assignmentType,
        posTableId: asTrimmedString((body as Record<string, unknown>).posTableId),
        customerName: asTrimmedString((body as Record<string, unknown>).customerName),
        customerPhone: asTrimmedString((body as Record<string, unknown>).customerPhone),
        customerExternalId: asTrimmedString(
          (body as Record<string, unknown>).customerExternalId,
        ),
      });
      return NextResponse.json({ ok: true, detail });
    }

    if (action === "getAccount") {
      const salesAccountId = asTrimmedString((body as Record<string, unknown>).salesAccountId);
      if (!salesAccountId) {
        return badRequest("salesAccountId is required.");
      }
      const detail = await getSalesAccountById({
        tenantId: device.tenantId,
        salesAccountId,
      });
      return NextResponse.json({ ok: true, detail });
    }

    if (action === "addSimpleLine") {
      const salesAccountId = asTrimmedString((body as Record<string, unknown>).salesAccountId);
      const createdByPosUserId = asTrimmedString(
        (body as Record<string, unknown>).createdByPosUserId,
      );
      const productId = asTrimmedString((body as Record<string, unknown>).productId);
      if (!salesAccountId || !createdByPosUserId || !productId) {
        return badRequest(
          "salesAccountId, createdByPosUserId and productId are required.",
        );
      }
      const detail = await addSimpleSalesAccountLine({
        tenantId: device.tenantId,
        tenantSlug: device.tenantSlug,
        salesAccountId,
        createdByPosUserId,
        productId,
        quantity: asInteger((body as Record<string, unknown>).quantity, 1),
        lineNote: asTrimmedString((body as Record<string, unknown>).lineNote),
      });
      return NextResponse.json({ ok: true, detail });
    }

    if (action === "voidLine") {
      const salesAccountId = asTrimmedString((body as Record<string, unknown>).salesAccountId);
      const salesAccountLineId = asTrimmedString(
        (body as Record<string, unknown>).salesAccountLineId,
      );
      const voidedByPosUserId = asTrimmedString(
        (body as Record<string, unknown>).voidedByPosUserId,
      );
      if (!salesAccountId || !salesAccountLineId || !voidedByPosUserId) {
        return badRequest(
          "salesAccountId, salesAccountLineId and voidedByPosUserId are required.",
        );
      }
      const detail = await voidSalesAccountLine({
        tenantId: device.tenantId,
        salesAccountId,
        salesAccountLineId,
        voidedByPosUserId,
        reason: asTrimmedString((body as Record<string, unknown>).reason),
      });
      return NextResponse.json({ ok: true, detail });
    }

    if (action === "capturePayment") {
      const salesAccountId = asTrimmedString((body as Record<string, unknown>).salesAccountId);
      const paidByPosUserId = asTrimmedString((body as Record<string, unknown>).paidByPosUserId);
      const paymentMethod = asTrimmedString((body as Record<string, unknown>).paymentMethod);
      if (!salesAccountId || !paidByPosUserId) {
        return badRequest("salesAccountId and paidByPosUserId are required.");
      }
      if (
        paymentMethod !== "cash" &&
        paymentMethod !== "card" &&
        paymentMethod !== "transfer"
      ) {
        return badRequest("paymentMethod is invalid.");
      }

      const detail = await captureSalesAccountPayment({
        tenantId: device.tenantId,
        salesAccountId,
        paidByPosUserId,
        paymentMethod,
        amountPaidCents: asInteger((body as Record<string, unknown>).amountPaidCents, 0),
        amountReceivedCents:
          (body as Record<string, unknown>).amountReceivedCents == null
            ? null
            : asInteger((body as Record<string, unknown>).amountReceivedCents, 0),
        cashShiftId: asTrimmedString((body as Record<string, unknown>).cashShiftId),
        externalReference: asTrimmedString(
          (body as Record<string, unknown>).externalReference,
        ),
      });
      return NextResponse.json({ ok: true, detail });
    }

    if (action === "closeAccount") {
      const salesAccountId = asTrimmedString((body as Record<string, unknown>).salesAccountId);
      const closedByPosUserId = asTrimmedString(
        (body as Record<string, unknown>).closedByPosUserId,
      );
      if (!salesAccountId || !closedByPosUserId) {
        return badRequest("salesAccountId and closedByPosUserId are required.");
      }
      const detail = await closeSalesAccount({
        tenantId: device.tenantId,
        salesAccountId,
        closedByPosUserId,
      });
      return NextResponse.json({ ok: true, detail });
    }

    return badRequest(`Unsupported action: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected runtime accounts error.";
    if (
      message.includes("required") ||
      message.includes("invalid") ||
      message.includes("cannot") ||
      message.includes("not found")
    ) {
      return badRequest(message);
    }
    return unauthorized(message);
  }
}
