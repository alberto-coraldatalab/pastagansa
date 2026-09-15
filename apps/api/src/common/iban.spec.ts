import { isValidIban, normalizeIban } from "./iban";

describe("IBAN helpers", () => {
  it("normalizes whitespace and validates the checksum", () => {
    const iban = normalizeIban("ES91 2100 0418 4502 0005 1332");
    expect(iban).toBe("ES9121000418450200051332");
    expect(isValidIban(iban!)).toBe(true);
  });

  it("rejects invalid formats and checksums", () => {
    expect(isValidIban("ES9121000418450200051333")).toBe(false);
    expect(isValidIban("not-an-iban")).toBe(false);
  });
});
