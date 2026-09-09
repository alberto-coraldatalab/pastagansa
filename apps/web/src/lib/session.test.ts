import { describe, expect, it } from "vitest";
import {
  normalizeApiError,
  selectMembership,
  type IdentityContext,
} from "./session";

const context: IdentityContext = {
  id: "user-1",
  email: "owner@example.com",
  memberships: [
    {
      organization: { id: "org-1", name: "Organización" },
      company: {
        id: "company-1",
        legalName: "Empresa Uno SL",
        taxId: "B12345674",
        country: "ES",
        baseCurrency: "EUR",
        timezone: "Europe/Madrid",
      },
      role: { code: "organization.owner", name: "Owner", permissions: [] },
    },
  ],
};

describe("session helpers", () => {
  it("keeps an authorized tenant selection", () => {
    expect(
      selectMembership(context, {
        organizationId: "org-1",
        companyId: "company-1",
      })?.company.legalName,
    ).toBe("Empresa Uno SL");
  });

  it("falls back to the first company for a forged selection", () => {
    expect(
      selectMembership(context, {
        organizationId: "other",
        companyId: "other",
      })?.company.id,
    ).toBe("company-1");
  });

  it("normalizes validation errors returned by the API", () => {
    expect(
      normalizeApiError({
        error: { message: ["Email inválido", "Revisa el NIF"] },
      }),
    ).toBe("Email inválido Revisa el NIF");
  });
});
