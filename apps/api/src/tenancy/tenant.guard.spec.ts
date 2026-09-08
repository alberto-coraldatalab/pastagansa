import { ForbiddenException } from "@nestjs/common";
import { TenantGuard } from "./tenant.guard";

describe("TenantGuard", () => {
  const prisma = { membership: { findMany: jest.fn() } } as any;
  const context = (request: any) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

  beforeEach(() => jest.clearAllMocks());

  it("never trusts tenant headers without an active membership", async () => {
    prisma.membership.findMany.mockResolvedValue([]);
    await expect(
      new TenantGuard(prisma).canActivate(
        context({
          user: { id: "user-a" },
          headers: { "x-organization-id": "org-b" },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("binds the selected tenant only after authorizing membership", async () => {
    prisma.membership.findMany.mockResolvedValue([
      { role: { code: "company.admin" } },
    ]);
    const request: any = {
      user: { id: "user-a" },
      headers: { "x-organization-id": "org-a", "x-company-id": "company-a" },
    };
    await expect(
      new TenantGuard(prisma).canActivate(context(request)),
    ).resolves.toBe(true);
    expect(request.tenant).toEqual({
      organizationId: "org-a",
      companyId: "company-a",
      userId: "user-a",
      roleCodes: ["company.admin"],
    });
  });
});
