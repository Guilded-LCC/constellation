// A webhook token is a scoped credential for one channel. The database checks
// its creator's current permissions on every request and rate-limits each hook.
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return Response.json({ error: "Use POST." }, { status: 405 });
  if (Number(request.headers.get("content-length") || 0) > 20000)
    return Response.json({ error: "Request is too large." }, { status: 413 });
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const body = await request.json();
    if (
      typeof body.content !== "string" ||
      !body.content.trim() ||
      body.content.length > 4000
    )
      return Response.json(
        { error: "Content must contain 1–4000 characters." },
        { status: 400 },
      );
    const key = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const response = await fetch(
      Deno.env.get("SUPABASE_URL") + "/rest/v1/rpc/app_webhook_post",
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_token: token, p_content: body.content }),
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
      { error: "Send a valid JSON object with a content field." },
      { status: 400 },
    );
  }
});
