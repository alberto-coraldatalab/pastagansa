import { z } from "zod";

export const catalogInputSchema = z.object({
  type: z.enum(["PRODUCT", "SERVICE"]),
  sku: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4_000).optional(),
  unit: z.string().trim().max(30).optional(),
  salesPrice: z.number().min(0).multipleOf(0.01).optional(),
  currency: z.string().length(3),
  suggestedTaxCode: z.string().trim().max(80).optional(),
  revenueAccountCode: z.string().trim().max(20).optional(),
  expenseAccountCode: z.string().trim().max(20).optional(),
  trackInventory: z.boolean(),
});

export interface CatalogItem {
  id: string;
  type: "PRODUCT" | "SERVICE";
  sku: string | null;
  name: string;
  description: string | null;
  unit: string;
  salesPrice: string | null;
  currency: string;
  suggestedTaxCode: string | null;
  revenueAccountCode: string | null;
  expenseAccountCode: string | null;
  trackInventory: boolean;
}

export interface CatalogPage {
  data: CatalogItem[];
  nextCursor: string | null;
}

export function catalogPayload(values: Record<string, FormDataEntryValue>) {
  const optional = (name: string) => {
    const value = String(values[name] ?? "").trim();
    return value || undefined;
  };
  const price = optional("salesPrice");
  return {
    type: String(values.type ?? "SERVICE"),
    sku: optional("sku"),
    name: String(values.name ?? "").trim(),
    description: optional("description"),
    unit: optional("unit"),
    salesPrice: price === undefined ? undefined : Number(price),
    currency: "EUR",
    suggestedTaxCode: optional("suggestedTaxCode"),
    revenueAccountCode: optional("revenueAccountCode"),
    expenseAccountCode: optional("expenseAccountCode"),
    trackInventory: values.type === "PRODUCT" && values.trackInventory === "on",
  };
}

export function formatMoney(value: string | null, currency: string) {
  if (value === null) return "Sin precio";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(Number(value));
}

export function taxLabel(code: string | null) {
  const labels: Record<string, string> = {
    ES_VAT_GENERAL_21: "IVA 21 %",
    ES_VAT_REDUCED_10: "IVA 10 %",
    ES_VAT_SUPER_REDUCED_4: "IVA 4 %",
    ES_VAT_ZERO_0: "IVA 0 %",
    ES_VAT_EXEMPT: "Exento",
    ES_VAT_NOT_SUBJECT: "No sujeto",
  };
  return code ? (labels[code] ?? code) : "Sin sugerencia";
}
