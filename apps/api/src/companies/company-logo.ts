import { BadRequestException } from "@nestjs/common";

export const MAX_COMPANY_LOGO_BYTES = 512 * 1024;
const MAX_LOGO_DIMENSION = 2048;
const MAX_LOGO_PIXELS = 4_194_304;

export type CompanyLogoDetails = {
  mediaType: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

export function inspectCompanyLogo(content: Buffer): CompanyLogoDetails {
  if (!content.length || content.length > MAX_COMPANY_LOGO_BYTES)
    throw new BadRequestException("Company logo must be no larger than 512 KiB");
  const details = isPng(content) ? parsePng(content) : isJpeg(content) ? parseJpeg(content) : undefined;
  if (!details)
    throw new BadRequestException("Company logo must be a valid PNG or JPEG image");
  if (
    details.width < 1 ||
    details.height < 1 ||
    details.width > MAX_LOGO_DIMENSION ||
    details.height > MAX_LOGO_DIMENSION ||
    details.width * details.height > MAX_LOGO_PIXELS
  )
    throw new BadRequestException("Company logo dimensions are not supported");
  return details;
}

export function normalizedLogoMediaType(value?: string) {
  const mediaType = value?.toLowerCase().trim();
  if (mediaType === "image/jpg") return "image/jpeg";
  return mediaType;
}

function isPng(content: Buffer) {
  return content.length >= 24 && content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function parsePng(content: Buffer): CompanyLogoDetails | undefined {
  if (content.subarray(12, 16).toString("ascii") !== "IHDR") return undefined;
  return { mediaType: "image/png", width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
}

function isJpeg(content: Buffer) {
  return content.length >= 4 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
}

function parseJpeg(content: Buffer): CompanyLogoDetails | undefined {
  let offset = 2;
  while (offset + 4 <= content.length) {
    if (content[offset] !== 0xff) return undefined;
    while (content[offset] === 0xff) offset += 1;
    const marker = content[offset++];
    if (marker === 0xd9 || marker === 0xda) return undefined;
    if (offset + 2 > content.length) return undefined;
    const length = content.readUInt16BE(offset);
    if (length < 2 || offset + length > content.length) return undefined;
    if (isStartOfFrame(marker)) {
      if (length < 8) return undefined;
      return {
        mediaType: "image/jpeg",
        height: content.readUInt16BE(offset + 3),
        width: content.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  return undefined;
}

function isStartOfFrame(marker: number) {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}
