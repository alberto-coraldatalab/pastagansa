import { NextResponse } from "next/server";
import { z } from "zod";
import { forward } from "../route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const input = z
    .object({ id: z.uuid(), jobId: z.uuid() })
    .safeParse(await params);
  if (!input.success)
    return NextResponse.json({ error: "OCR no válido." }, { status: 400 });
  return forward(
    `/v1/purchase-invoices/${input.data.id}/ocr/${input.data.jobId}`,
  );
}
