import { NextRequest, NextResponse } from "next/server";
import http from "node:http";
import { CORE_URL } from "@/lib/core";

const coreUrl = new URL(CORE_URL);
const API_HOST = coreUrl.hostname;
const API_PORT = Number(coreUrl.port) || 80;

// The core can be slow on aggregating routes (systems, observability/overview
// walk several tables). Without a deadline a hung core holds the browser
// request open forever, which reads as "the page is still loading".
const TIMEOUT_MS = Number(process.env.CURLYOS_PROXY_TIMEOUT_MS) || 30_000;

function apiRequest(
  method: string,
  path: string,
  body?: string,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // The core's bearer gate is dormant unless CURLYOS_API_TOKEN is set. Read it
    // here so arming the core does not silently break every page.
    const token = process.env.CURLYOS_API_TOKEN?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;

    const options: http.RequestOptions = {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/${path}`,
      method,
      headers,
      timeout: TIMEOUT_MS,
    };
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode || 200, data: JSON.parse(text) });
        } catch {
          resolve({ status: res.statusCode || 200, data: { raw: text } });
        }
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error(`core did not respond within ${TIMEOUT_MS}ms`));
    });
    req.on("error", (e) => {
      console.error("API proxy error:", e.message);
      reject(e);
    });
    if (body) req.write(body);
    req.end();
  });
}

async function forward(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
) {
  const { path } = await paramsPromise;
  const url = new URL(request.url);
  const apiPath = path.join("/") + url.search;
  try {
    const body =
      method === "GET" || method === "DELETE" ? undefined : await request.text();
    const { status, data } = await apiRequest(method, apiPath, body);
    return NextResponse.json(data, { status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[proxy] ${method} /api/${apiPath}: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, ctx.params, "GET");
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, ctx.params, "POST");
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  return forward(request, ctx.params, "PUT");
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return forward(request, ctx.params, "PATCH");
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  return forward(request, ctx.params, "DELETE");
}
