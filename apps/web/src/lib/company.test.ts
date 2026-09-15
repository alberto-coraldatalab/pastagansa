import { describe, expect, it } from "vitest";
import {
  companySettingsInput,
  normalizeCompanySettings,
  type CompanySettings,
} from "./company";

const company: CompanySettings = {
  id: "company-1",
  legalName: "Coral Data Lab, S.L.",
  taxId: "B01876543",
  country: "ES",
  baseCurrency: "EUR",
  timezone: "Europe/Madrid",
  documentProfile: null,
  documentLogo: null,
};

describe("company settings helpers", () => {
  it("fills profile defaults for a company without a profile", () => {
    expect(companySettingsInput(company).documentProfile).toMatchObject({
      addressCountry: "ES",
      primaryColor: "#F71950",
    });
  });

  it("trims optional empty values before saving", () => {
    const input = companySettingsInput(company);
    input.legalName = "  Coral Data Lab, S.L.  ";
    input.documentProfile.phone = "   ";
    expect(normalizeCompanySettings(input)).toMatchObject({
      legalName: "Coral Data Lab, S.L.",
      documentProfile: { phone: null },
    });
  });
});
