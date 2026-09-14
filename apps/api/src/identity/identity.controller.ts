import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { IdentityService } from "./identity.service";
import { Authenticated } from "./authenticated.decorator";
import { AuthenticatedRequest } from "../tenancy/tenant.types";
import { Throttle } from "@nestjs/throttler";

@Controller("identity")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() input: RegisterDto) {
    return this.identity.register(input);
  }

  @HttpCode(200)
  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() input: LoginDto) {
    return this.identity.login(input);
  }

  @HttpCode(204)
  @Post("password-reset")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.identity.resetPassword(input);
  }

  @HttpCode(200)
  @Post("refresh")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  refresh(@Body() input: RefreshDto) {
    return this.identity.rotate(input.refreshToken);
  }

  @Get("sessions")
  @Authenticated()
  sessions(@Req() request: AuthenticatedRequest) {
    return this.identity.sessions(request.user!.id, request.user!.sessionId);
  }

  @HttpCode(204)
  @Delete("sessions/:id")
  @Authenticated()
  revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.identity.revokeSession(request.user!.id, sessionId);
  }

  @HttpCode(204)
  @Put("password")
  @Authenticated()
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
  ) {
    return this.identity.changePassword(
      request.user!.id,
      request.user!.sessionId,
      input,
    );
  }

  @Get("context")
  @Authenticated()
  context(@Req() request: AuthenticatedRequest) {
    return this.identity.context(request.user!.id);
  }

  @HttpCode(204)
  @Post("logout")
  @Authenticated()
  logout(@Req() request: AuthenticatedRequest) {
    return this.identity.revoke(request.user!.id, request.user!.sessionId);
  }
}
