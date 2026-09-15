import { NextResponse } from "next/server";
import { logoutSession } from "@/lib/server-session";

export async function POST() {
  await logoutSession();
  return new NextResponse(null, {
    status: 303,
    headers: { location: "/acceso" },
  });
}
