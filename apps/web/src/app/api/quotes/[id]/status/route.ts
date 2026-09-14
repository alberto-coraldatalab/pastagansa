import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteStatuses } from "@/lib/quotes";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const inputSchema = z.object({
  expectedStatus: z.enum(quoteStatuses),
  status: z.enum(quoteStatuses),
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
    return NextResponse.json({ error: "Cambio de estado no válido." }, { status: 400 });
  try {
    const response = await tenantApiRequest(`/v1/quotes/${id.data}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.data),
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
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "No podemos conectar con el servicio." },
      { status: 503 },
    );
  }
}
