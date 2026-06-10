import { NextRequest, NextResponse } from "next/server";
import http from "node:http";
import { CORE_URL } from "@/lib/core";

const coreUrl = new URL(CORE_URL);
const API_HOST = coreUrl.hostname;
const API_PORT = Number(coreUrl.port) || 80;

function apiRequest(method: string, path: string, body?: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/${path}`,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(options, (res) => {
      let chunks: Buffer[] = [];
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
    req.on("error", (e) => {
      console.error("API proxy error:", e.message);
      reject(e);
    });
    if (body) req.write(body);
    req.end();
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const apiPath = path.join("/") + url.search;
  console.log(`[proxy] GET /api/${apiPath}`);
  try {
    const { status, data } = await apiRequest("GET", apiPath);
    console.log(`[proxy] → ${status}`);
    return NextResponse.json(data, { status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[proxy] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const apiPath = path.join("/") + url.search;
  console.log(`[proxy] POST /api/${apiPath}`);
  try {
    const body = await request.text();
    const { status, data } = await apiRequest("POST", apiPath, body);
    console.log(`[proxy] → ${status}`);
    return NextResponse.json(data, { status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[proxy] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const apiPath = path.join("/") + url.search;
  console.log(`[proxy] PATCH /api/${apiPath}`);
  try {
    const body = await request.text();
    const { status, data } = await apiRequest("PATCH", apiPath, body);
    console.log(`[proxy] → ${status}`);
    return NextResponse.json(data, { status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[proxy] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
