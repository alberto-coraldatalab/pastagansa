import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionError, tenantApiRequest } from "@/lib/server-session";
import { normalizeApiError } from "@/lib/session";

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

export async function GET() {
  return forwardSessions();
}

export async function PUT(request: Request) {
  const input = passwordSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "La nueva contraseña debe tener entre 12 y 128 caracteres." },
      { status: 400 },
    );
  try {
    const response = await tenantApiRequest("/v1/identity/password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      return NextResponse.json(
        {
          error:
            response.status === 401
              ? "La contraseña actual no es correcta."
              : normalizeApiError(body),
        },
        { status: response.status },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "El servicio no está disponible." },
      { status: 503 },
    );
  }
}

async function forwardSessions() {
  try {
    const response = await tenantApiRequest("/v1/identity/sessions");
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
      { error: "El servicio no está disponible." },
      { status: 503 },
    );
  }
}
