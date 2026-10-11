import { Controller, Post, Get, Body, Res, Req, UseGuards, HttpCode } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
    @Req() req: any,
  ) {
    const { email, password } = body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || email.length > 254 || password.length > 256) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'Email and password are required' });
    }

    const key = req.ip || 'local';
    if (this.attempts.size > 1000) for (const [ip, entry] of this.attempts) if (entry.until < Date.now()) this.attempts.delete(ip);
    const attempt = this.attempts.get(key);
    if (attempt && attempt.until > Date.now() && attempt.count >= 12) return res.status(429).json({ message: 'Too many sign-in attempts. Try again in one minute.' });
    this.attempts.set(key, { count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1, until: Date.now() + 60000 });
    const { token, user } = await this.authService.login(email.trim().toLowerCase(), password);
    this.attempts.delete(key);

    // Set HTTP-only secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { ok: true, token, user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token');
    return { ok: true, message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return { ok: true, user: req.user };
  }
}
