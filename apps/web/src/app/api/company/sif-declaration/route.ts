import { NextResponse } from "next/server";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET() {
  try {
    const response = await tenantApiRequest(
      "/v1/companies/current/sif-declaration",
    );
    if (!response.ok)
      return NextResponse.json(
        { error: normalizeApiError(await response.json().catch(() => undefined)) },
        { status: response.status },
      );
    return new NextResponse(response.body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": response.headers.get("content-disposition") ?? "attachment; filename=declaracion-responsable-sif.pdf",
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "No podemos conectar con el servicio." },
      { status: 503 },
    );
  }
}
