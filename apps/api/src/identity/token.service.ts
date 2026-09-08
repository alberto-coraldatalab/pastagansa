import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWTPayload, jwtVerify, SignJWT } from 'jose';

export interface TokenPair { accessToken: string; refreshToken: string; }
export interface RefreshClaims { sub: string; sid: string; }

@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTtl: number;
  private readonly refreshTtlDays: number;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('JWT_SECRET');
    if (secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
    this.secret = new TextEncoder().encode(secret);
    this.issuer = config.get<string>('JWT_ISSUER') ?? 'pastagansa';
    this.audience = config.get<string>('JWT_AUDIENCE') ?? 'pastagansa-api';
    this.accessTtl = Number(config.get<string>('ACCESS_TOKEN_TTL_SECONDS') ?? 900);
    this.refreshTtlDays = Number(config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 30);
  }

  refreshExpiresAt(): Date { return new Date(Date.now() + this.refreshTtlDays * 86_400_000); }

  async issue(userId: string, sessionId: string): Promise<TokenPair> {
    const accessToken = await this.sign({ sub: userId, typ: 'access' }, `${this.accessTtl}s`);
    const refreshToken = await this.sign({ sub: userId, sid: sessionId, typ: 'refresh' }, `${this.refreshTtlDays}d`);
    return { accessToken, refreshToken };
  }

  async verifyAccess(token: string): Promise<string> {
    const payload = await this.verify(token);
    if (payload.typ !== 'access' || !payload.sub) throw new UnauthorizedException('Invalid access token');
    return payload.sub;
  }

  async verifyRefresh(token: string): Promise<RefreshClaims> {
    const payload = await this.verify(token);
    if (payload.typ !== 'refresh' || !payload.sub || typeof payload.sid !== 'string') throw new UnauthorizedException('Invalid refresh token');
    return { sub: payload.sub, sid: payload.sid };
  }

  private async sign(payload: JWTPayload, expiresIn: string): Promise<string> {
    return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuer(this.issuer).setAudience(this.audience).setIssuedAt().setExpirationTime(expiresIn).sign(this.secret);
  }

  private async verify(token: string): Promise<JWTPayload> {
    try {
      return (await jwtVerify(token, this.secret, { issuer: this.issuer, audience: this.audience })).payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
