export function validateConfiguration(values: Record<string, unknown>) {
  const required = ["DATABASE_URL", "JWT_SECRET"];
  for (const name of required)
    if (typeof values[name] !== "string" || !values[name])
      throw new Error(`${name} is required`);
  if (String(values.JWT_SECRET).length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  positiveInteger(values, "ACCESS_TOKEN_TTL_SECONDS", 900);
  positiveInteger(values, "REFRESH_TOKEN_TTL_DAYS", 30);
  return values;
}
function positiveInteger(
  values: Record<string, unknown>,
  name: string,
  fallback: number,
) {
  const value = Number(values[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  values[name] = String(value);
}
