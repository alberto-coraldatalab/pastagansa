import { isSpanishTaxId } from "./validation";
describe("isSpanishTaxId", () => {
  it.each(["12345678Z", "X2482300W", "B12345674"])(
    "accepts valid %s",
    (value) => expect(isSpanishTaxId(value)).toBe(true),
  );
  it.each(["12345678A", "X2482300A", "B12345678"])(
    "rejects invalid %s",
    (value) => expect(isSpanishTaxId(value)).toBe(false),
  );
});
