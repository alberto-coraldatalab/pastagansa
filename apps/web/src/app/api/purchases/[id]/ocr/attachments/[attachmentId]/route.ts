import { NextResponse } from "next/server";
import { z } from "zod";
import { forward } from "../../route";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const input = z
    .object({ id: z.uuid(), attachmentId: z.uuid() })
    .safeParse(await params);
  if (!input.success)
    return NextResponse.json({ error: "Adjunto no válido." }, { status: 400 });
  return forward(
    `/v1/purchase-invoices/${input.data.id}/ocr/attachments/${input.data.attachmentId}`,
    { method: "POST" },
  );
}
