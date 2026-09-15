import { NextRequest, NextResponse } from "next/server";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const allowed = ["asOf", "bucket", "status", "text"] as const;

export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const name of allowed) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) params.set(name, value);
  }
  try {
    const response = await tenantApiRequest(
      `/v1/collections/invoices.csv?${params}`,
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "No se pudo exportar la cartera." },
        { status: response.status },
      );
    return new NextResponse(response.body, {
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "text/csv; charset=utf-8",
        "content-disposition":
          response.headers.get("content-disposition") ??
          "attachment; filename=cartera.csv",
      },
    });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No podemos exportar la cartera." },
      { status: 503 },
    );
  }
}
