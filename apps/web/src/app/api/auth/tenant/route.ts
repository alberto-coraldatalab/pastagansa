import { NextResponse } from "next/server";
import { z } from "zod";
import { changeTenant, SessionError } from "@/lib/server-session";

const schema = z.object({
  organizationId: z.string().uuid(),
  companyId: z.string().uuid(),
});

export async function PUT(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => undefined));
  if (!input.success)
    return NextResponse.json(
      { error: "La empresa seleccionada no es válida." },
      { status: 400 },
    );
  try {
    const membership = await changeTenant(input.data);
    return NextResponse.json({ company: membership.company });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No podemos cambiar de empresa ahora mismo." },
      { status: 503 },
    );
  }
}
