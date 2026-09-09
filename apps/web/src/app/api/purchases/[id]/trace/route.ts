import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return NextResponse.json({ error: "Compra no válida." }, { status: 400 });
  try {
    const journal = await tenantApiRequest(
      `/v1/accounting/journal-entries?sourceType=PURCHASE_INVOICE&sourceId=${id.data}&limit=1`,
    );
    if (!journal.ok) return apiError(journal);
    const journalPage = (await journal.json()) as { data: unknown[] };
    const tax = await tenantApiRequest(
      `/v1/tax-ledger?direction=PURCHASES&bookType=RECEIVED_INVOICES&purchaseInvoiceId=${id.data}&limit=1`,
    );
    if (!tax.ok) return apiError(tax);
    const taxPage = (await tax.json()) as { data: unknown[] };
    return NextResponse.json({
      journalEntry: journalPage.data[0] ?? null,
      taxEntry: taxPage.data[0] ?? null,
    });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No podemos conectar con el servicio." },
      { status: 503 },
    );
  }
}

async function apiError(response: Response) {
  return NextResponse.json(
    { error: normalizeApiError(await response.json().catch(() => undefined)) },
    { status: response.status },
  );
}
