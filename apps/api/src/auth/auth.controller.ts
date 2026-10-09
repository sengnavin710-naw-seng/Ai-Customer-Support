import { Body, Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';
import type { AuthRequest } from './auth.guard';
class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }
  @Get('me') me(@Req() req: AuthRequest) {
    return req.user;
  }
  @Post('logout') @HttpCode(204) logout(@Req() req: AuthRequest) {
    this.auth.logout(req.token);
  }
}
