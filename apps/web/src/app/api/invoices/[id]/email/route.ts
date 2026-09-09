import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceEmailInputSchema } from "@/lib/invoices";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const requestSchema = invoiceEmailInputSchema.extend({
  idempotencyKey: z.string().trim().min(1).max(128),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [id, input] = await Promise.all([
    z.uuid().safeParseAsync((await params).id),
    requestSchema.safeParseAsync(await request.json().catch(() => undefined)),
  ]);
  if (!id.success || !input.success)
    return NextResponse.json(
      { error: "Revisa el destinatario y el asunto del correo." },
      { status: 400 },
    );
  const { idempotencyKey, ...message } = input.data;
  return forward(`/v1/invoices/${id.data}/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(message),
  });
}

async function forward(path: string, init: RequestInit) {
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
      { error: "No podemos poner el correo en cola." },
      { status: 503 },
    );
  }
}
