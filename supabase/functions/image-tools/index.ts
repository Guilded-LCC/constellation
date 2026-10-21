// Staff-only image helper: imports a remote image or removes its background
// with remove.bg. The API key stays in Supabase secrets, never in the browser.
const MAX_BYTES = 12 * 1024 * 1024;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    ["localhost", "0.0.0.0"].includes(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.includes(":")
  )
    return true;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function fetchRemoteImage(rawUrl: unknown) {
  if (typeof rawUrl !== "string" || !rawUrl.trim())
    throw Object.assign(new Error("Enter an image URL."), { status: 400 });
  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    throw Object.assign(new Error("Enter a valid image URL."), { status: 400 });
  }
  for (let hop = 0; hop < 4; hop += 1) {
    if (!["http:", "https:"].includes(target.protocol))
      throw Object.assign(new Error("Only http and https image URLs are supported."), { status: 400 });
    if (blockedHost(target.hostname))
      throw Object.assign(new Error("That image host is not allowed."), { status: 400 });
    const response = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Constellation icon importer" },
    }).catch(() => {
      throw Object.assign(new Error("Could not reach that image URL."), { status: 502 });
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw Object.assign(new Error("That image URL redirected without a destination."), { status: 502 });
      target = new URL(location, target);
      continue;
    }
    if (!response.ok)
      throw Object.assign(new Error(`The image host returned ${response.status}.`), { status: 502 });
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/"))
      throw Object.assign(new Error("That URL does not point to an image."), { status: 415 });
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES)
      throw Object.assign(new Error("That image is too large. Use one under 12MB."), { status: 413 });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES)
      throw Object.assign(new Error("That image is too large. Use one under 12MB."), { status: 413 });
    if (!bytes.byteLength)
      throw Object.assign(new Error("That image URL returned an empty file."), { status: 502 });
    return { bytes, contentType };
  }
  throw Object.assign(new Error("That image URL redirected too many times."), { status: 502 });
}

async function removeBackground(bytes: Uint8Array, contentType: string, key: string) {
  if (!key)
    throw Object.assign(new Error("Background removal is not configured."), { status: 503 });
  const form = new FormData();
  form.append("image_file", new Blob([bytes], { type: contentType || "image/png" }), "image.png");
  form.append("size", "auto");
  form.append("format", "png");
  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": key },
    body: form,
    signal: AbortSignal.timeout(60000),
  }).catch(() => {
    throw Object.assign(new Error("Could not reach the background removal service."), { status: 502 });
  });
  const output = new Uint8Array(await response.arrayBuffer());
  if (!response.ok) {
    let message = "The background removal service could not process that image.";
    try {
      const parsed = JSON.parse(new TextDecoder().decode(output));
      message = parsed?.errors?.[0]?.title || message;
    } catch {}
    throw Object.assign(new Error(message), { status: response.status === 402 ? 402 : 502 });
  }
  return output;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json(405, { error: "Use POST." });

  const projectUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const authorization = request.headers.get("Authorization") || "";
  if (!projectUrl || !anonKey || !authorization)
    return json(401, { error: "Sign in as staff to use image tools." });

  const staffCheck = await fetch(`${projectUrl.replace(/\/$/, "")}/rest/v1/rpc/is_platform_staff`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch(() => null);
  if (!staffCheck?.ok)
    return json(403, { error: "Your staff role does not allow this action." });
  const allowed = await staffCheck.json().catch(() => false);
  if (allowed !== true)
    return json(403, { error: "Your staff role does not allow this action." });

  try {
    const action = new URL(request.url).searchParams.get("action");
    if (action === "import") {
      let body: { url?: unknown };
      try {
        body = await request.json();
      } catch {
        throw Object.assign(new Error("Send a JSON body with an image URL."), { status: 400 });
      }
      const result = await fetchRemoteImage(body?.url);
      return new Response(result.bytes, {
        status: 200,
        headers: { ...CORS, "Content-Type": result.contentType, "Cache-Control": "no-store" },
      });
    }
    if (action === "remove-bg") {
      const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!contentType.startsWith("image/"))
        throw Object.assign(new Error("Send an image file to remove its background."), { status: 415 });
      const declared = Number(request.headers.get("content-length") || 0);
      if (declared > MAX_BYTES)
        throw Object.assign(new Error("That image is too large. Use one under 12MB."), { status: 413 });
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (!bytes.byteLength)
        throw Object.assign(new Error("The image is empty."), { status: 400 });
      if (bytes.byteLength > MAX_BYTES)
        throw Object.assign(new Error("That image is too large. Use one under 12MB."), { status: 413 });
      const output = await removeBackground(bytes, contentType, Deno.env.get("REMOVE_BG_API_KEY") || "");
      return new Response(output, {
        status: 200,
        headers: { ...CORS, "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    }
    return json(404, { error: "Unknown image action." });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 500;
    const message = status === 500 ? "The image service failed. Please try again." : (error as Error).message;
    if (status === 500) console.error("[image-tools]", error);
    return json(status, { error: message });
  }
});
