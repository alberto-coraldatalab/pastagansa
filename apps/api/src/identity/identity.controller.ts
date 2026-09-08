import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { IdentityService } from './identity.service';

@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  register(@Body() input: RegisterDto) { return this.identity.register(input); }

  @HttpCode(200)
  @Post('login')
  login(@Body() input: LoginDto) { return this.identity.login(input); }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() input: RefreshDto) { return this.identity.rotate(input.refreshToken); }
}
