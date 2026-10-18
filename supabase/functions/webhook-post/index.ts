// A webhook token is a scoped credential for one channel. The database checks
// its creator's current permissions on every request and rate-limits each hook.
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return Response.json({ error: "Use POST." }, { status: 405 });
  if (Number(request.headers.get("content-length") || 0) > 20000)
    return Response.json({ error: "Request is too large." }, { status: 413 });
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "A JSON body is required." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 20000) {
        await reader.cancel();
        return Response.json({ error: "Request is too large." }, { status: 413 });
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let body: { content?: unknown };
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { return Response.json({ error: "Send a valid JSON object with a content field." }, { status: 400 }); }
    if (
      typeof body.content !== "string" ||
      !body.content.trim() ||
      body.content.length > 4000
    )
      return Response.json(
        { error: "Content must contain 1–4000 characters." },
        { status: 400 },
      );
    const projectUrl = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    if (!projectUrl || !key)
      return Response.json({ error: "Webhook delivery is temporarily unavailable." }, { status: 503 });
    const response = await fetch(
      projectUrl.replace(/\/$/, "") + "/rest/v1/rpc/app_webhook_post",
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_token: token, p_content: body.content }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok)
      return Response.json(
        {
          error:
            "This webhook is invalid, has lost permission, or is sending too quickly.",
        },
        { status: 403 },
      );
    return Response.json(await response.json(), { status: 201 });
  } catch {
    return Response.json(
      { error: "The webhook request could not be processed." },
      { status: 502 },
    );
  }
});
