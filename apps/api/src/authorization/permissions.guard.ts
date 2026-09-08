import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { AuthenticatedRequest } from "../tenancy/tenant.types";
import { REQUIRED_PERMISSIONS } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tenant)
      throw new ForbiddenException("A tenant context is required");
    const matches = await this.prisma.rolePermission.findMany({
      where: {
        role: { code: { in: request.tenant.roleCodes } },
        permission: { code: { in: required } },
      },
      select: { permission: { select: { code: true } } },
    });
    const granted = new Set(matches.map(({ permission }) => permission.code));
    if (required.some((permission) => !granted.has(permission)))
      throw new ForbiddenException("Missing required permission");
    return true;
  }
}
