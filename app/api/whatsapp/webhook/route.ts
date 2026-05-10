import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

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

    if (message) {
      console.log("WHATSAPP_INCOMING_MESSAGE", {
        from: message.from,
        type: message.type,
        text: message.text?.body ?? null,
        messageId: message.id,
        timestamp: message.timestamp,
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("META_WEBHOOK_POST_ERROR", error);
    return NextResponse.json(
      { received: false, error: "Invalid payload" },
      { status: 400 }
    );
  }
}