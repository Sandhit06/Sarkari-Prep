import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createGuestSession(preferredLanguage = 'en') {
    const user = await this.prisma.user.create({
      data: {
        name: `Guest Aspirant #${Math.floor(1000 + Math.random() * 9000)}`,
        isGuest: true,
        profile: {
          create: {
            targetExamSlugs: ['ssc-cgl', 'upsc-cse'],
            preferredLanguage,
          },
        },
      },
      include: { profile: true },
    });
    return { user, token: this.signToken(user.id, user.role) };
  }

  async upgradeGuestToAccount(guestUserId: string, email: string, name: string, passwordPlain: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email is already registered');

    const passwordHash = crypto.createHash('sha256').update(passwordPlain).digest('hex');
    const updated = await this.prisma.user.update({
      where: { id: guestUserId },
      data: {
        email,
        name,
        passwordHash,
        isGuest: false,
      },
      include: { profile: true },
    });
    return { user: updated, token: this.signToken(updated.id, updated.role) };
  }

  private signToken(userId: string, role: string): string {
    const payload = Buffer.from(JSON.stringify({ sub: userId, role, iat: Date.now() })).toString('base64url');
    return `sp_jwt_${payload}`;
  }
}
