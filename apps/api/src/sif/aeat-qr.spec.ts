import { aeatQrPng, aeatQrUrl } from "./aeat-qr";

describe("AEAT fiscal QR", () => {
  it("builds the production non-VERI*FACTU URL with encoded invoice data", () => {
    expect(aeatQrUrl({
      issuerTaxId: "b12345674",
      invoiceNumber: "F2027/0001 & special",
      issueDate: new Date("2027-01-02T00:00:00Z"),
      total: "1478.62",
      mode: "NO_VERIFACTU",
      environment: "PRODUCTION",
    })).toBe("https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=B12345674&numserie=F2027%2F0001%20%26%20special&fecha=02-01-2027&importe=1478.62");
  });

  it("renders a PNG QR with level M-compatible settings", async () => {
    const png = await aeatQrPng("https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=F1&fecha=01-01-2027&importe=1.00");
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it("rejects invalid AEAT QR inputs", () => {
    expect(() => aeatQrUrl({ issuerTaxId: "bad", invoiceNumber: "F1", issueDate: new Date("2027-01-01"), total: "1", mode: "VERIFACTU", environment: "TEST" })).toThrow(/NIF/);
    expect(() => aeatQrUrl({ issuerTaxId: "B12345674", invoiceNumber: "F1", issueDate: new Date("2027-01-01"), total: "1.999", mode: "VERIFACTU", environment: "TEST" })).toThrow(/total/);
  });
});
