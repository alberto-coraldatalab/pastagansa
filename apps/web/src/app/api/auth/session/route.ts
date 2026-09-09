import { NextResponse } from "next/server";
import { currentSession, SessionError } from "@/lib/server-session";

export async function GET() {
  try {
    return NextResponse.json(await currentSession());
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
