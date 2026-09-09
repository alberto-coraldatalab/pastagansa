import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const createSchema = z.object({
  documentType: z.literal("INVOICE"),
  series: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/),
  startingNumber: z.number().int().min(1).optional(),
  padding: z.number().int().min(1).max(12).optional(),
});

export async function GET() {
  return forward("/v1/document-sequences");
}

export async function POST(request: Request) {
  const input = createSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "La serie debe empezar por una letra o número." },
      { status: 400 },
    );
  return forward("/v1/document-sequences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input.data),
  });
}

async function forward(path: string, init?: RequestInit) {
  try {
    const response = await tenantApiRequest(path, init);
    const body = await response.json().catch(() => undefined);
    if (!response.ok)
      return NextResponse.json(
        { error: normalizeApiError(body) },
        { status: response.status },
      );
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No podemos conectar con el servicio." },
      { status: 503 },
    );
  }
}
