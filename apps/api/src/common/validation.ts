import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

const CURRENCIES = new Set(Intl.supportedValuesOf("currency"));
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function IsNotBlank(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isNotBlank",
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === "string" && value.trim().length > 0,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must not be blank`,
      },
    });
}

export function IsCurrencyCode(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isCurrencyCode",
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === "string" && CURRENCIES.has(value),
        defaultMessage: () =>
          "currency must be a valid uppercase ISO 4217 code",
      },
    });
}

export function IsSpanishTaxId(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isSpanishTaxId",
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === "string" && isSpanishTaxId(value),
        defaultMessage: () => "taxId must be a valid Spanish NIF, NIE, or CIF",
      },
    });
}

export function isSpanishTaxId(value: string): boolean {
  const id = value.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{8}[A-Z]$/.test(id))
    return DNI_LETTERS[Number(id.slice(0, 8)) % 23] === id[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(id))
    return (
      DNI_LETTERS[
        Number(
          id.replace("X", "0").replace("Y", "1").replace("Z", "2").slice(0, 8),
        ) % 23
      ] === id[8]
    );
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(id)) return false;
  const digits = id.slice(1, 8).split("").map(Number);
  const odd = [0, 2, 4, 6].reduce((sum, index) => {
    const doubled = digits[index] * 2;
    return sum + Math.floor(doubled / 10) + (doubled % 10);
  }, 0);
  const even = digits[1] + digits[3] + digits[5];
  const control = (10 - ((odd + even) % 10)) % 10;
  const expected = "JABCDEFGHI"[control];
  return /[PQRSNW]/.test(id[0])
    ? id[8] === expected
    : /[ABEH]/.test(id[0])
      ? id[8] === String(control)
      : id[8] === String(control) || id[8] === expected;
}
