import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, SessionError } from "@/lib/server-session";

const schema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
  organizationName: z.string().trim().min(1).max(160),
  legalName: z.string().trim().min(1).max(240),
  taxId: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => undefined));
  if (!input.success)
    return NextResponse.json(
      {
        error:
          "Revisa los campos. La contraseña debe tener al menos 12 caracteres.",
      },
      { status: 400 },
    );
  try {
    const membership = await authenticate("register", input.data);
    return NextResponse.json({ company: membership.company }, { status: 201 });
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
