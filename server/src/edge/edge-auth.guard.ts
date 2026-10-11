import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EdgeAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const rawKey = req.headers['x-edge-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!rawKey) {
      throw new UnauthorizedException({ code: 'EDGE_AUTH_REQUIRED', message: 'Missing X-Edge-Api-Key header' });
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Find matching edge node
    const edgeNode = await this.prisma.edgeNode.findFirst({
      where: { apiKeyHash: keyHash },
    });

    if (!edgeNode) {
      throw new UnauthorizedException({ code: 'INVALID_EDGE_KEY', message: 'Unauthorized edge key' });
    }

    req.edgeNode = edgeNode;
    return true;
  }
}
