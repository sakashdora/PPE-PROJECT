import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private jwt: JwtService, private prisma: PrismaService) { }
    async canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer /, '');
        try {
            if (!token)
                throw Error();
            const payload = await this.jwt.verifyAsync(token);
            const user = await this.prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, email: true, name: true, role: true } });
            if (!user)
                throw Error();
            req.user = user;
            return true;
        }
        catch {
            throw new UnauthorizedException('Sign in to continue');
        }
    }
}
