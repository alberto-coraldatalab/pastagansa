import { NextResponse } from "next/server";
import { logoutSession } from "@/lib/server-session";

export async function POST(request: Request) {
  await logoutSession();
  return NextResponse.redirect(new URL("/acceso", request.url), 303);
}
