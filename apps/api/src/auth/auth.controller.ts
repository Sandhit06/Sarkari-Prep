import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('guest')
  createGuest(@Body('preferredLanguage') preferredLanguage?: string) {
    return this.authService.createGuestSession(preferredLanguage);
  }

  @Post('upgrade-guest')
  upgradeGuest(
    @Body() body: { guestUserId: string; email: string; name: string; password: string },
  ) {
    return this.authService.upgradeGuestToAccount(body.guestUserId, body.email, body.name, body.password);
  }
}
