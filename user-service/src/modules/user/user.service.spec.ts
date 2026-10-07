import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthProvider, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterUserDto } from './dto/user-register.dto';
import { UserService } from './user.service';

// bcrypt is replaced by a deterministic fake (see beforeEach): fast, no native binding.
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

const bcryptMock = bcrypt as unknown as { hash: jest.Mock; compare: jest.Mock };

describe('UserService', () => {
  let service: UserService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userSession: { updateMany: jest.fn() },
    userAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Transactions run their callback against the same mock
    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prismaMock),
    );
    bcryptMock.hash.mockImplementation(async (plain: string) => `hashed(${plain})`);

    const moduleRef = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(UserService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ------------------------------------------------------------- register
  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      password: 'Secret123',
      firstName: 'Ana',
      lastName: 'Perez',
    } as RegisterUserDto;

    beforeEach(() => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      // Echo what would be persisted, including the password, to prove the response strips it
      prismaMock.user.create.mockImplementation(async ({ data }) => ({
        id: 'u-new',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
        profile: data.profile.create,
      }));
    });

    it('hashes the password and creates a LOCAL/USER account with a profile', async () => {
      await service.register(dto, '1.2.3.4', 'jest-agent');

      expect(bcryptMock.hash).toHaveBeenCalledWith('Secret123', 10);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          password: 'hashed(Secret123)',
          authProvider: AuthProvider.LOCAL,
          role: Role.USER,
          profile: {
            create: { firstName: 'Ana', lastName: 'Perez', fullName: 'Ana Perez' },
          },
        },
        include: { profile: true },
      });
    });

    it('writes a REGISTER audit entry in the same transaction', async () => {
      await service.register(dto, '1.2.3.4', 'jest-agent');

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.userAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-new',
          action: 'REGISTER',
          ipAddress: '1.2.3.4',
          userAgent: 'jest-agent',
        },
      });
    });

    it('returns a sanitized response without the password', async () => {
      const result = await service.register(dto);

      expect(result).toMatchObject({ id: 'u-new', email: 'new@example.com', role: 'USER' });
      expect(result).not.toHaveProperty('password');
    });

    it('builds the full name from whatever name parts were provided', async () => {
      await service.register({ ...dto, lastName: undefined } as RegisterUserDto);

      const { data } = prismaMock.user.create.mock.calls[0][0];
      expect(data.profile.create.fullName).toBe('Ana');
    });

    it('rejects an email that already belongs to a non-deleted user', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' });

      await expect(service.register(dto)).rejects.toThrow('User already exists');

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { email: dto.email, deletedAt: null },
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('requires a password for LOCAL accounts', async () => {
      await expect(
        service.register({ ...dto, password: undefined } as RegisterUserDto),
      ).rejects.toThrow('Password is required');

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('creates OAuth accounts with a null password and no hashing', async () => {
      await service.register({
        ...dto,
        password: undefined,
        authProvider: AuthProvider.GOOGLE,
      } as RegisterUserDto);

      expect(bcryptMock.hash).not.toHaveBeenCalled();
      const { data } = prismaMock.user.create.mock.calls[0][0];
      expect(data.password).toBeNull();
      expect(data.authProvider).toBe(AuthProvider.GOOGLE);
    });
  });

  // ------------------------------------------------------------- findById
  describe('findById', () => {
    it('returns the user with relations but without the password hash', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'ana@example.com',
        password: 'hashed(Secret123)',
        profile: { fullName: 'Ana Perez' },
        addresses: [],
        paymentMethods: [],
      });

      const result = await service.findById('u1');

      expect(result).toMatchObject({ id: 'u1', email: 'ana@example.com' });
      expect(result).not.toHaveProperty('password');
    });

    it('excludes soft-deleted users and soft-deleted addresses/payment methods', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' });

      await service.findById('u1');

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', deletedAt: null },
        include: {
          profile: true,
          addresses: { where: { deletedAt: null } },
          paymentMethods: { where: { deletedAt: null } },
        },
      });
    });

    it('throws when the user does not exist', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow('User not found');
    });
  });

  // ----------------------------------------------------------- softDelete
  describe('softDelete', () => {
    it('marks the user deleted, revokes their sessions and audits, atomically', async () => {
      const result = await service.softDelete('u1');

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prismaMock.userAuditLog.create).toHaveBeenCalledWith({
        data: { userId: 'u1', action: 'SOFT_DELETE' },
      });
      expect(result).toEqual({ success: true });
    });

    it('propagates a failure so the transaction can roll back', async () => {
      prismaMock.$transaction.mockRejectedValue(new Error('tx failed'));

      await expect(service.softDelete('u1')).rejects.toThrow('tx failed');
    });

    it.todo('rejects an unknown user with a domain error instead of a raw Prisma P2025');
  });

  // ------------------------------------------------ checkDatabaseConnection
  describe('checkDatabaseConnection', () => {
    it('returns true when the database answers', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(service.checkDatabaseConnection()).resolves.toBe(true);
    });

    it('throws a generic error when the database is unreachable', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.checkDatabaseConnection()).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  // ------------------------------------------------------------ findByIds
  describe('findByIds', () => {
    it('returns an empty list without querying when no ids are given', async () => {
      await expect(service.findByIds([])).resolves.toEqual([]);

      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });

    it('fetches all ids in a single query and selects only non-sensitive fields', async () => {
      const users = [{ id: 'u1' }, { id: 'u2' }];
      prismaMock.user.findMany.mockResolvedValue(users);

      const result = await service.findByIds(['u1', 'u2']);

      expect(result).toBe(users);
      expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1', 'u2'] } },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('returns only the users found when some ids do not exist', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }]);

      await expect(service.findByIds(['u1', 'ghost'])).resolves.toEqual([{ id: 'u1' }]);
    });

    it('wraps database errors with context', async () => {
      prismaMock.user.findMany.mockRejectedValue(new Error('boom'));

      await expect(service.findByIds(['u1'])).rejects.toThrow(
        'Error al buscar usuarios: boom',
      );
    });

    it.todo('excludes soft-deleted users (findById does, findByIds does not)');
  });

  // ---------------------------------------------------- findByIdsPaginated
  describe('findByIdsPaginated', () => {
    it.each([
      // page, limit, total, expectedSkip, expectedTotalPages
      [1, 50, 120, 0, 3],
      [3, 10, 25, 20, 3],
      [2, 5, 5, 5, 1],
      [1, 10, 0, 0, 0],
    ])(
      'page %i, limit %i, total %i -> skip %i, %i pages',
      async (page, limit, total, expectedSkip, expectedTotalPages) => {
        prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }]);
        prismaMock.user.count.mockResolvedValue(total);

        const result = await service.findByIdsPaginated(['u1', 'u2'], page, limit);

        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
          where: { id: { in: ['u1', 'u2'] } },
          skip: expectedSkip,
          take: limit,
          select: { id: true, email: true, role: true },
        });
        expect(result).toEqual({
          data: [{ id: 'u1' }],
          meta: { total, page, limit, totalPages: expectedTotalPages },
        });
      },
    );

    it('defaults to page 1 with 50 items per page', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const result = await service.findByIdsPaginated(['u1']);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
      expect(result.meta).toMatchObject({ page: 1, limit: 50 });
    });
  });
});