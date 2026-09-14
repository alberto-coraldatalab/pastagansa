import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
const schema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => undefined));
  if (!input.success)
    return NextResponse.json(
      { error: "El enlace o la nueva contraseña no son válidos." },
      { status: 400 },
    );

  try {
    const response = await fetch(`${apiBaseUrl}/v1/identity/password-reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.data),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      return NextResponse.json(
        { error: normalizeApiError(body) },
        { status: response.status },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "El servicio no está disponible." },
      { status: 503 },
    );
  }
}
