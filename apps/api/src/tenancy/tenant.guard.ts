import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { TENANT_PROTECTED } from "./tenant.decorator";
import { AuthenticatedRequest } from "./tenant.types";

/**
 * The authentication layer must put the verified JWT subject on request.user.
 * Tenant IDs are selected by headers but authorized exclusively through memberships.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector &&
      !this.reflector.getAllAndOverride<boolean>(TENANT_PROTECTED, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.id) throw new UnauthorizedException();
    const organizationId = readHeader(request, "x-organization-id");
    const companyId = readHeader(request, "x-company-id");
    if (!organizationId)
      throw new ForbiddenException("x-organization-id is required");

    const memberships = await this.prisma.membership.findMany({
      where: {
        userId: request.user.id,
        organizationId,
        status: "ACTIVE",
        ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
      },
      include: { role: { select: { code: true } } },
    });
    if (!memberships.length)
      throw new ForbiddenException("No active membership for this tenant");

    request.tenant = {
      organizationId,
      companyId,
      userId: request.user.id,
      roleCodes: memberships.map(({ role }) => role.code),
    };
    return true;
  }
}

function readHeader(
  request: AuthenticatedRequest,
  name: string,
): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
