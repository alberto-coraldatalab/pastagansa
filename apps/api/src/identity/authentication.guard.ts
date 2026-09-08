import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { AuthenticatedRequest } from "../tenancy/tenant.types";
import { TokenService } from "./token.service";
import { AUTHENTICATION_REQUIRED } from "./authenticated.decorator";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization)
      ? authorization[0]
      : authorization;
    const required = this.reflector.getAllAndOverride<boolean>(
      AUTHENTICATION_REQUIRED,
      [context.getHandler(), context.getClass()],
    );
    if (!value) {
      if (required) throw new UnauthorizedException();
      return true;
    }
    const match = /^Bearer (.+)$/i.exec(value);
    if (!match)
      throw new UnauthorizedException(
        "Authorization must use the Bearer scheme",
      );
    const claims = await this.tokens.verifyAccess(match[1]);
    const session = await this.prisma.session.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
        user: { status: "ACTIVE" },
      },
      select: { id: true },
    });
    if (!session)
      throw new UnauthorizedException("Session is no longer active");
    request.user = { id: claims.userId, sessionId: claims.sessionId };
    return true;
  }
}
