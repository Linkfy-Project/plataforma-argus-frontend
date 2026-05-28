import { createFileRoute } from "@tanstack/react-router";

const BACKEND =
  process.env.ARGUS_BACKEND_URL ||
  process.env.VITE_API_BASE_URL ||
  "https://argus-backend-5bio.onrender.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Access-Control-Max-Age": "86400",
};

/**
 * Proxy transparente para a API FastAPI da Plataforma Argus.
 *
 * Qualquer requisição para `/api/argus/<path>` é encaminhada para
 * `<BACKEND>/<path>`, contornando o CORS do Render. O timeout é generoso
 * para suportar cold start (~90s) do Render Free.
 */
async function forward(request: Request, splat: string | undefined) {
  const root = BACKEND.replace(/\/$/, "");
  const path = splat ? `/${splat}` : "";
  const search = new URL(request.url).search;
  const target = `${root}${path}${search}`;

  const init: RequestInit = {
    method: request.method,
    headers: (() => {
      const h = new Headers();
      const ct = request.headers.get("content-type");
      const accept = request.headers.get("accept");
      const auth = request.headers.get("authorization");
      if (ct) h.set("content-type", ct);
      if (accept) h.set("accept", accept);
      if (auth) h.set("authorization", auth);
      return h;
    })(),
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 95_000);
  init.signal = controller.signal;

  try {
    const upstream = await fetch(target, init);
    const headers = new Headers();
    const passthrough = ["content-type", "content-disposition", "cache-control", "etag"];
    for (const k of passthrough) {
      const v = upstream.headers.get(k);
      if (v) headers.set(k, v);
    }
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream error";
    return new Response(
      JSON.stringify({ error: "Argus backend indisponível", detail: msg }),
      { status: 502, headers: { "content-type": "application/json", ...CORS } },
    );
  } finally {
    clearTimeout(timeout);
  }
}

const handler = async ({ request, params }: { request: Request; params: { _splat?: string } }) =>
  forward(request, params._splat);

export const Route = createFileRoute("/api/argus/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
    },
  },
});