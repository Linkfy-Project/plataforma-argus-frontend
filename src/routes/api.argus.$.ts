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

type BackendWork = {
  municipio?: string | null;
  efficiency_score?: number | null;
  due_at?: string | null;
  finished_at?: string | null;
  status?: string | null;
  signed_at?: string | null;
  created_at?: string | null;
  contract_value?: number | null;
  alerts?: Array<{ severity?: string | null }>;
};

type PaginatedWorks = {
  items: BackendWork[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

const normalizeMunicipio = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*-\s*rj$/, "")
    .trim();

const matchesMunicipio = (work: BackendWork, municipio: string) => {
  const actual = normalizeMunicipio(work.municipio ?? "");
  const expected = normalizeMunicipio(municipio);
  return actual === expected || actual.includes(expected) || expected.includes(actual);
};

async function fetchWorks(root: string, params: URLSearchParams, init: RequestInit) {
  const out: BackendWork[] = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const next = new URLSearchParams(params);
    next.delete("municipio");
    next.set("page", String(page));
    next.set("per_page", String(perPage));
    const response = await fetch(`${root}/api/v1/works?${next.toString()}`, init);
    if (!response.ok) throw new Error(`Argus backend respondeu ${response.status}`);
    const payload = (await response.json()) as PaginatedWorks;
    out.push(...(payload.items ?? []));
    if (out.length >= payload.total || (payload.items ?? []).length < perPage) break;
    page += 1;
  }

  return out;
}

function summarize(works: BackendWork[]) {
  const scores = works.map((w) => w.efficiency_score).filter((score): score is number => score != null);
  const now = new Date();
  return {
    total_works: works.length,
    average_efficiency_score: scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
      : 0,
    delayed_works: works.filter((w) => {
      if (w.status?.toLowerCase().includes("atras")) return true;
      return Boolean(w.due_at && !w.finished_at && new Date(w.due_at) < now);
    }).length,
    critical_alerts: works.reduce(
      (sum, w) =>
        sum +
        (w.alerts ?? []).filter((a) =>
          ["critical", "critico", "crítico", "danger"].includes(a.severity?.toLowerCase() ?? ""),
        ).length,
      0,
    ),
  };
}

function trends(works: BackendWork[]) {
  const groups = new Map<string, { scoreSum: number; scoreCount: number; count: number; totalValue: number }>();
  for (const work of works) {
    const month = (work.signed_at ?? work.created_at ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const group = groups.get(month) ?? { scoreSum: 0, scoreCount: 0, count: 0, totalValue: 0 };
    group.count += 1;
    group.totalValue += work.contract_value ?? 0;
    if (work.efficiency_score != null) {
      group.scoreSum += work.efficiency_score;
      group.scoreCount += 1;
    }
    groups.set(month, group);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, group]) => ({
      month,
      avg_score: group.scoreCount ? Number((group.scoreSum / group.scoreCount).toFixed(2)) : 0,
      count: group.count,
      total_value: Number(group.totalValue.toFixed(2)),
    }));
}

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