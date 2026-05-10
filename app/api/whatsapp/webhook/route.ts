import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v23.0";
const WHATSAPP_TENANT_SLUG = process.env.WHATSAPP_TENANT_SLUG ?? "expo-cuu";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("META_WEBHOOK_VERIFY_ATTEMPT", {
    mode,
    hasToken: Boolean(token),
    hasChallenge: Boolean(challenge),
  });

  if (!VERIFY_TOKEN) {
    console.error("Missing WHATSAPP_VERIFY_TOKEN env var");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("META_WEBHOOK_VERIFIED");

    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  console.warn("META_WEBHOOK_VERIFY_FAILED");

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("META_WEBHOOK_EVENT_RECEIVED");
    console.log(JSON.stringify(body, null, 2));

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    // Si el webhook es de status de mensaje u otro evento, no respondemos.
    if (!message) {
      console.log("NO_INCOMING_MESSAGE_FOUND");

      return NextResponse.json({ received: true }, { status: 200 });
    }

    const from = message.from;
    const type = message.type;
    const text = message.text?.body ?? "";

    const recipient = normalizeRecipientForMetaTest(from);

    console.log("WHATSAPP_INCOMING_MESSAGE", {
      from,
      recipient,
      type,
      text,
      messageId: message.id,
      timestamp: message.timestamp,
    });

    try {
      if (type !== "text") {
        await sendWhatsAppText(
          recipient,
          "Por ahora solo puedo procesar mensajes de texto."
        );

        return NextResponse.json({ received: true }, { status: 200 });
      }

      const responseText = await buildTextResponse(text);
      await sendWhatsAppText(recipient, responseText);
    } catch (sendError) {
      // Importante: no regresamos 400/500 a Meta por un fallo al enviar.
      // Así evitamos reintentos innecesarios del webhook.
      console.error("WHATSAPP_SEND_FAILED", sendError);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("META_WEBHOOK_POST_ERROR", error);

    // Para webhooks conviene responder 200 aunque haya error interno,
    // especialmente en pruebas, para evitar reintentos repetidos de Meta.
    return NextResponse.json(
      { received: true, error: "Webhook processed with internal error" },
      { status: 200 }
    );
  }
}

async function buildTextResponse(text: string) {
  const normalizedText = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const sections: string[] = [];

  if (/hola/i.test(normalizedText)) {
    sections.push("Hola, qué gusto saludarte. ¿En qué te puedo apoyar hoy?");
  }

  if (/carne/i.test(normalizedText)) {
    sections.push(await buildCarneInventoryMessage());
  }

  if (/\beventos?\b/i.test(normalizedText)) {
    sections.push(await buildEventsMessage());
  }

  if (sections.length > 0) {
    return sections.join("\n\n");
  }

  return `Recibí tu mensaje: "${text}". El webhook ya está funcionando ✅`;
}

async function getWebhookTenantId() {
  const supabase = createWebhookSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,slug")
    .eq("slug", WHATSAPP_TENANT_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`No fue posible resolver tenant WhatsApp: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`Tenant WhatsApp no encontrado: ${WHATSAPP_TENANT_SLUG}`);
  }

  return data.id as string;
}

async function buildCarneInventoryMessage() {
  const supabase = createWebhookSupabaseClient();
  const tenantId = await getWebhookTenantId();

  const { data, error } = await supabase
    .from("kitchen_inventory_items")
    .select(
      "id,name,kitchen_inventory_units:kitchen_inventory_units!kitchen_inventory_items_tenant_default_unit_fkey(code),kitchen_inventory_balances:kitchen_inventory_balances!kitchen_inventory_balances_tenant_item_fkey(quantity)",
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .ilike("name", "%carne%")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`No fue posible consultar insumos de carne: ${error.message}`);
  }

  const rows = (data ?? []).map((item) => {
    const unit = normalizeEmbeddedSingle<{ code?: string }>(item.kitchen_inventory_units)?.code ?? "kg";
    const total = normalizeEmbeddedArray<{ quantity?: string | number }>(item.kitchen_inventory_balances).reduce(
      (sum, balance) => sum + Number(balance.quantity ?? 0),
      0,
    );

    return {
      name: String(item.name ?? "Insumo"),
      unit,
      total,
    };
  });

  if (rows.length === 0) {
    return "No encontré insumos activos que contengan la palabra carne.";
  }

  const lines = rows.map((row) => `• ${row.name}: ${formatQuantity(row.total)} ${row.unit}`);
  return [`Inventario de insumos con “carne”:`, ...lines].join("\n");
}

async function buildEventsMessage() {
  const supabase = createWebhookSupabaseClient();
  const tenantId = await getWebhookTenantId();

  const { data, error } = await supabase
    .from("events")
    .select("id,name,status,starts_at,expected_attendance")
    .eq("tenant_id", tenantId)
    .order("starts_at", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`No fue posible consultar eventos: ${error.message}`);
  }

  const events = data ?? [];
  if (events.length === 0) {
    return "No encontré eventos registrados por ahora.";
  }

  const lines = events.map((event) => {
    const date = event.starts_at ? new Date(event.starts_at).toLocaleDateString("es-MX") : "sin fecha";
    const attendance = event.expected_attendance ? ` · ${event.expected_attendance} asistentes` : "";
    const status = event.status ? ` · ${event.status}` : "";
    return `• ${event.name ?? "Evento sin nombre"} · ${date}${attendance}${status}`;
  });

  return [`Eventos registrados:`, ...lines].join("\n");
}

function createWebhookSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseServiceRoleConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeEmbeddedSingle<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return (value ?? null) as T | null;
}

function normalizeEmbeddedArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null) return [];
  return [value as T];
}

function formatQuantity(value: number) {
  return value.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

async function sendWhatsAppText(to: string, text: string) {
  if (!WHATSAPP_ACCESS_TOKEN) {
    throw new Error("Missing WHATSAPP_ACCESS_TOKEN env var");
  }

  if (!WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID env var");
  }

  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  const responseBody = await response.text();

  console.log("WHATSAPP_SEND_RESPONSE", {
    to,
    status: response.status,
    ok: response.ok,
    body: responseBody,
  });

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${responseBody}`);
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    return responseBody;
  }
}

function normalizeRecipientForMetaTest(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");

  /*
    Caso México en entorno de prueba de Meta:

    El webhook puede recibir:
      5215554338269

    Pero en API Setup / allowed list Meta puede tener:
      525554338269

    Por eso quitamos el "1" después de "52" cuando el número
    viene en formato 521 + 10 dígitos.
  */
  if (digits.startsWith("521") && digits.length === 13) {
    const normalized = `52${digits.slice(3)}`;

    console.log("WHATSAPP_RECIPIENT_NORMALIZED", {
      original: digits,
      normalized,
      reason: "MX_TEST_ALLOWED_LIST_FORMAT",
    });

    return normalized;
  }

  return digits;
}
