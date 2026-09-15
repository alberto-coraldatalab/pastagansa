export type CompanyDocumentProfile = {
  tradeName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  addressCountry: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  bankIban: string | null;
  paymentInstructions: string | null;
  paymentTerms: string | null;
  defaultNotes: string | null;
  documentFooter: string | null;
  primaryColor: string | null;
  invoiceEmailSubjectTemplate: string | null;
  quoteEmailSubjectTemplate: string | null;
  emailBodyTemplate: string | null;
};

export type CompanySettings = {
  id: string;
  legalName: string;
  taxId: string;
  country: string;
  baseCurrency: string;
  timezone: string;
  sifMode: "DISABLED" | "NO_VERIFACTU" | "VERIFACTU";
  aeatEnvironment: "TEST" | "PRODUCTION";
  documentProfile: CompanyDocumentProfile | null;
  documentLogo: {
    id: string;
    mediaType: "image/png" | "image/jpeg";
    sizeBytes: number;
    width: number;
    height: number;
    sha256: string;
    updatedAt: string;
  } | null;
};

export type CompanySettingsInput = Pick<
  CompanySettings,
  "legalName" | "baseCurrency" | "timezone" | "sifMode" | "aeatEnvironment"
> & { documentProfile: CompanyDocumentProfile };

export const emptyDocumentProfile: CompanyDocumentProfile = {
  tradeName: null,
  addressLine1: null,
  addressLine2: null,
  postalCode: null,
  city: null,
  province: null,
  addressCountry: "ES",
  email: null,
  phone: null,
  website: null,
  bankIban: null,
  paymentInstructions: null,
  paymentTerms: null,
  defaultNotes: null,
  documentFooter: null,
  primaryColor: "#F71950",
  invoiceEmailSubjectTemplate: "Factura {{document_number}}",
  quoteEmailSubjectTemplate: "Presupuesto {{document_number}}",
  emailBodyTemplate: "{{company_name}} adjunta {{document_type}} {{document_number}}.",
};

const documentProfileFields = Object.keys(emptyDocumentProfile) as Array<
  keyof CompanyDocumentProfile
>;

export function companySettingsInput(company: CompanySettings): CompanySettingsInput {
  return {
    legalName: company.legalName,
    baseCurrency: company.baseCurrency,
    timezone: company.timezone,
    sifMode: company.sifMode,
    aeatEnvironment: company.aeatEnvironment,
    documentProfile: editableDocumentProfile(company.documentProfile),
  };
}

export function normalizeCompanySettings(input: CompanySettingsInput) {
  return {
    legalName: input.legalName.trim(),
    baseCurrency: input.baseCurrency.trim().toUpperCase(),
    timezone: input.timezone.trim(),
    sifMode: input.sifMode,
    aeatEnvironment: input.aeatEnvironment,
    documentProfile: Object.fromEntries(
      documentProfileFields.map((key) => {
        const value = input.documentProfile[key];
        return [
          key,
        typeof value === "string" && value.trim() === "" ? null : value?.trim() ?? null,
        ];
      }),
    ),
  };
}

function editableDocumentProfile(
  profile: CompanyDocumentProfile | null,
): CompanyDocumentProfile {
  return Object.fromEntries(
    documentProfileFields.map((field) => [
      field,
      profile?.[field] ?? emptyDocumentProfile[field],
    ]),
  ) as CompanyDocumentProfile;
}
