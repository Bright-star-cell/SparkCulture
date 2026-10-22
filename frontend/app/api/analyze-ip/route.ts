import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getBackendUrl() {
  const configuredUrl =
    process.env.BACKEND_INTERNAL_URL?.trim() || process.env.BACKEND_URL?.trim();
  if (configuredUrl) {
    const backendOrigin = /^https?:\/\//i.test(configuredUrl)
      ? configuredUrl
      : `https://${configuredUrl}`;
    return `${backendOrigin.replace(/\/+$/, "")}/api/analyze-ip`;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:8000/api/analyze-ip";
  }

  return null;
}

function getResponseSnippet(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 200);
}

export async function POST(request: Request) {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { detail: "The analysis backend is not configured. Set BACKEND_INTERNAL_URL or BACKEND_URL." },
      { status: 500 },
    );
  }

  const headers = new Headers(request.headers);
  for (const header of ["connection", "content-length", "host", "transfer-encoding"]) {
    headers.delete(header);
  }

  let backendResponse: Response;
  let responseBody: string;
  try {
    backendResponse = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
      cache: "no-store",
    });
    responseBody = await backendResponse.text();
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach the analysis backend. Check its URL and availability." },
      { status: 502 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseBody);
  } catch {
    return NextResponse.json(
      {
        detail: `The analysis backend returned a non-JSON response (HTTP ${backendResponse.status}).`,
        response_snippet: getResponseSnippet(responseBody),
      },
      { status: backendResponse.ok ? 502 : backendResponse.status },
    );
  }

  return NextResponse.json(payload, { status: backendResponse.status });
}
