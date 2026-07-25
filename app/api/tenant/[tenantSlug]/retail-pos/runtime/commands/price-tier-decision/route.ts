import { NextResponse } from "next/server";
import { resolveRetailPosPriceTierCommand } from "@/lib/retail-pos/price-tier-decision";

export async function POST(request: Request, context: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await context.params;
  try {
    const body = await request.json();
    const result = await resolveRetailPosPriceTierCommand({
      tenantSlug,
      command: body,
      deviceId: request.headers.get("x-retail-pos-device-id"),
      deviceSecret: request.headers.get("x-retail-pos-device-secret"),
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resolve price tiers." }, { status });
  }
}
