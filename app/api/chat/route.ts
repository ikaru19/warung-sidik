export const dynamic = "force-dynamic";

type ChatRequestBody = {
  message?: string;
  query?: string;
  conversationId?: string;
  conversation_id?: string;
  user?: string;
  inputs?: Record<string, unknown>;
  files?: Array<{
    type: string;
    transfer_method: string;
    url?: string;
    upload_file_id?: string;
  }>;
};

const CHAT_MESSAGES_PATH = "/v1/chat-messages";

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function resolveDifyUrl() {
  const direct = process.env.DIFY_API_URL?.trim();
  if (direct) {
    try {
      const url = new URL(direct);
      if (url.pathname === "/" || url.pathname === "") return `${url.origin}${CHAT_MESSAGES_PATH}`;
      if (url.pathname.endsWith("/v1")) {
        return `${url.origin}${url.pathname}${CHAT_MESSAGES_PATH.slice("/v1".length)}`;
      }
      if (url.pathname.endsWith("/v1/")) {
        return `${url.origin}${url.pathname}${CHAT_MESSAGES_PATH.slice("/v1/".length)}`;
      }
    } catch {
      return direct;
    }

    return direct;
  }

  const base = process.env.DIFY_BASE_URL?.trim();
  if (base) {
    const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${normalizedBase}${CHAT_MESSAGES_PATH}`;
  }

  return undefined;
}

export async function POST(request: Request) {
  const debug = isTruthyEnv(process.env.DIFY_DEBUG);
  const debugLogContent = isTruthyEnv(process.env.DIFY_DEBUG_LOG_CONTENT);

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Missing DIFY_API_KEY" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const message = (body.message ?? body.query)?.trim();
  if (!message) {
    return Response.json(
      { error: "Missing message" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const difyUrl = resolveDifyUrl();
  if (!difyUrl) {
    return Response.json(
      { error: "Missing DIFY_API_URL or DIFY_BASE_URL" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }

  if (debug) {
    const inputsKeys =
      body.inputs && typeof body.inputs === "object" ? Object.keys(body.inputs) : [];
    const files = (body.files ?? []).map((f) => ({
      type: f.type,
      transfer_method: f.transfer_method,
      url: f.url,
      upload_file_id: f.upload_file_id,
    }));

    console.log("[api/chat] incoming", {
      messageLength: message.length,
      message: debugLogContent ? message.slice(0, 500) : undefined,
      conversationId: body.conversationId ?? body.conversation_id ?? null,
      user: body.user ?? "warung-sidik-web",
      inputsKeys,
      filesCount: files.length,
      files: debugLogContent ? files : undefined,
    });
  }

  const upstreamPayload = {
    inputs: body.inputs ?? {},
    query: message,
    response_mode: "streaming",
    conversation_id: body.conversationId ?? body.conversation_id ?? "",
    user: body.user ?? "warung-sidik-web",
    files: body.files ?? undefined,
  };

  if (debug) {
    console.log("[api/chat] upstream request", {
      body: debugLogContent ? upstreamPayload : { ...upstreamPayload, query: undefined },
    });
  }

  const upstream = await fetch(difyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamPayload),
  });

  if (debug) {
    console.log("[api/chat] upstream response (streaming)", {
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
    });
  }

  if (!upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(text || "Upstream error", {
      status: upstream.status || 502,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status || 502,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
