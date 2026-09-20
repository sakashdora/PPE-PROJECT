import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(pass, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    await this.audit.log({
      userId: user.id,
      action: 'login',
      entity: 'user',
      entityId: user.id,
      meta: { email: user.email, role: user.role },
    });

    return { token, user: payload };
  }

  async validateUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
