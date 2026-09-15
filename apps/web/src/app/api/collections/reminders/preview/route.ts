import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const inputSchema = z.object({ template: z.enum(["DUE_SOON", "OVERDUE_FIRST", "OVERDUE_SECOND"]), invoiceIds: z.array(z.uuid()).min(1).max(100) });

export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json().catch(() => undefined));
  if (!input.success) return NextResponse.json({ error: "Selecciona facturas y una plantilla válidas." }, { status: 400 });
  return forward("/v1/collections/reminders/preview", input.data);
}

async function forward(path: string, body: unknown) {
  try {
    const response = await tenantApiRequest(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => undefined);
    if (!response.ok) return NextResponse.json({ error: normalizeApiError(data) }, { status: response.status });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No podemos preparar los recordatorios." }, { status: 503 });
  }
}
