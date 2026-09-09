import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return NextResponse.json({ error: "Factura no válida." }, { status: 400 });
  try {
    const response = await tenantApiRequest(`/v1/invoices/${id.data}/pdf`);
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      return NextResponse.json(
        { error: normalizeApiError(body) },
        { status: response.status },
      );
    }
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/pdf",
        "content-disposition":
          response.headers.get("content-disposition") ??
          'attachment; filename="factura.pdf"',
      },
    });
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
