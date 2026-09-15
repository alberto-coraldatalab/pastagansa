import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const eventSchema = z.object({ type: z.enum(["ACCEPTED", "REJECTED", "DISPUTED", "PAYMENT_PROMISED"]), source: z.enum(["USER", "EMAIL", "BANK", "SYSTEM", "EINVOICE"]), effectiveAt: z.iso.datetime(), comment: z.string().trim().max(1000).optional() });
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { return forward("GET", (await params).id); }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = eventSchema.safeParse(await request.json().catch(() => undefined));
  if (!input.success) return NextResponse.json({ error: "El evento comercial no es válido." }, { status: 400 });
  return forward("POST", (await params).id, input.data);
}
async function forward(method: string, idValue: string, body?: unknown) {
  const id = z.uuid().safeParse(idValue); if (!id.success) return NextResponse.json({ error: "Factura inválida." }, { status: 400 });
  try { const response = await tenantApiRequest(`/v1/invoices/${id.data}/commercial-events`, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) }); const data = await response.json().catch(() => undefined); if (!response.ok) return NextResponse.json({ error: normalizeApiError(data) }, { status: response.status }); return NextResponse.json(data, { status: response.status }); }
  catch (error) { if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: "No podemos acceder a la cronología." }, { status: 503 }); }
}
