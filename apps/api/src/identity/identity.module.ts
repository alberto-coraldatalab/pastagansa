import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { TokenService } from './token.service';

@Module({ controllers: [IdentityController], providers: [IdentityService, TokenService], exports: [TokenService] })
export class IdentityModule {}
