import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const inputSchema = z.object({
  sequenceId: z.uuid(),
  idempotencyKey: z.string().trim().min(1).max(128),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [id, input] = await Promise.all([
    z.uuid().safeParseAsync((await params).id),
    inputSchema.safeParseAsync(await request.json().catch(() => undefined)),
  ]);
  if (!id.success || !input.success)
    return NextResponse.json(
      { error: "La serie o la solicitud de emisión no son válidas." },
      { status: 400 },
    );
  try {
    const response = await tenantApiRequest(`/v1/invoices/${id.data}/issue`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": input.data.idempotencyKey,
      },
      body: JSON.stringify({ sequenceId: input.data.sequenceId }),
    });
    const body = await response.json().catch(() => undefined);
    if (!response.ok)
      return NextResponse.json(
        { error: normalizeApiError(body) },
        { status: response.status },
      );
    return NextResponse.json(body);
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
