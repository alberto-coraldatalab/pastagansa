import { NextResponse } from "next/server";
import { z } from "zod";
import { forward } from "../../route";

const schema = z.object({
  fields: z.record(z.string(), z.string().max(500).nullable()),
  notes: z.string().trim().min(1).max(1000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const input = z
    .object({ id: z.uuid(), jobId: z.uuid() })
    .safeParse(await params);
  const review = schema.safeParse(await request.json().catch(() => undefined));
  if (!input.success || !review.success)
    return NextResponse.json(
      { error: "Revisa los campos y añade una nota de revisión." },
      { status: 400 },
    );
  return forward(
    `/v1/purchase-invoices/${input.data.id}/ocr/${input.data.jobId}/review`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(review.data),
    },
  );
}
