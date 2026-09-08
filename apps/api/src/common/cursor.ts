import { BadRequestException } from "@nestjs/common";

interface CursorPayload {
  v: 1;
  id: string;
  sort: string;
  query: string;
}

export function encodeCursor(id: string, sort: string, query = ""): string {
  return Buffer.from(
    JSON.stringify({ v: 1, id, sort, query } satisfies CursorPayload),
  ).toString("base64url");
}

export function decodeCursor(value: string, query = ""): CursorPayload {
  try {
    const payload = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<CursorPayload>;
    if (
      payload.v !== 1 ||
      typeof payload.id !== "string" ||
      typeof payload.sort !== "string" ||
      payload.query !== query
    )
      throw new Error();
    return payload as CursorPayload;
  } catch {
    throw new BadRequestException(
      "Cursor is invalid or does not match the current filters",
    );
  }
}
