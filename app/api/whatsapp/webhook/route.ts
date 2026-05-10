import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v23.0";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("META_WEBHOOK_VERIFY_ATTEMPT", {
    mode,
    token,
    challenge,
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

    // Si el webhook es de status de mensaje, no respondemos.
    if (!message) {
      console.log("NO_INCOMING_MESSAGE_FOUND");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const from = message.from;
    const type = message.type;
    const text = message.text?.body ?? "";

    console.log("WHATSAPP_INCOMING_MESSAGE", {
      from,
      type,
      text,
      messageId: message.id,
      timestamp: message.timestamp,
    });

    if (type !== "text") {
      await sendWhatsAppText(
        from,
        "Por ahora solo puedo procesar mensajes de texto."
      );

      return NextResponse.json({ received: true }, { status: 200 });
    }

    await sendWhatsAppText(
      from,
      `Recibí tu mensaje: "${text}". El webhook ya está funcionando ✅`
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("META_WEBHOOK_POST_ERROR", error);

    return NextResponse.json(
      { received: false, error: "Invalid payload" },
      { status: 400 }
    );
  }
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
    status: response.status,
    ok: response.ok,
    body: responseBody,
  });

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${responseBody}`);
  }

  return JSON.parse(responseBody);
}