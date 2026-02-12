import bcrypt from 'bcrypt';
import { UserRepository } from '../user/user.repository';
import { PrismaService } from '../../prisma/prisma.service';

export class AuthService {
  constructor(
    private prisma: PrismaService,
    private userRepo: UserRepository,
  ) {}
  async register(data: any) {
    const existingUser = await this.userRepo.findByEmail(data.email)

    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          profile: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName,
              fullName: `${data.firstName} ${data.lastName}`
            },
          },
        },
        include: { profile: true },
      });

      await tx.userAuditLog.create({
        data: {
          userId: createdUser.id,
          action: 'REGISTER',
        },
      });

      return createdUser;
    });

    return this.toSafeUser(user)
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('Account locked temporarily');
    }
    const validPassword = await bcrypt.compare(password, user.password!)
    if (!validPassword) {
      await this.userRepo.incrementLoginAttempts(user.id);
      throw new Error('Invalid credentials');
    }

    await this.userRepo.resetLoginAttempts(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return this.toSafeUser(user)
  }

  private toSafeUser(user: any) {
    const { password, ...safeUser } = user
    return safeUser
  }
}
