import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, SessionError } from "@/lib/server-session";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => undefined));
  if (!input.success)
    return NextResponse.json(
      { error: "Revisa el correo y la contraseña." },
      { status: 400 },
    );
  try {
    const membership = await authenticate("login", input.data);
    return NextResponse.json({ company: membership.company });
  } catch (error) {
    return authError(error);
  }
}

function authError(error: unknown) {
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
