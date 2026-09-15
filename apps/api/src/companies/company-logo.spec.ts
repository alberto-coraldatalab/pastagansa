import { BadRequestException } from "@nestjs/common";
import { inspectCompanyLogo } from "./company-logo";

describe("inspectCompanyLogo", () => {
  it("reads dimensions from a PNG signature", () => {
    expect(inspectCompanyLogo(png(300, 180))).toEqual({
      mediaType: "image/png",
      width: 300,
      height: 180,
    });
  });

  it("rejects non-images and oversized dimensions", () => {
    expect(() => inspectCompanyLogo(Buffer.from("not an image"))).toThrow(
      BadRequestException,
    );
    expect(() => inspectCompanyLogo(png(2049, 20))).toThrow(
      BadRequestException,
    );
  });
});

function png(width: number, height: number) {
  const content = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(content, 0);
  content.writeUInt32BE(13, 8);
  content.write("IHDR", 12, "ascii");
  content.writeUInt32BE(width, 16);
  content.writeUInt32BE(height, 20);
  return content;
}
