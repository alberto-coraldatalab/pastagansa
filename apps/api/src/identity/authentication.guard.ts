import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest } from '../tenancy/tenant.types';
import { TokenService } from './token.service';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!value) return true;
    const match = /^Bearer (.+)$/i.exec(value);
    if (!match) throw new UnauthorizedException('Authorization must use the Bearer scheme');
    request.user = { id: await this.tokens.verifyAccess(match[1]) };
    return true;
  }
}
