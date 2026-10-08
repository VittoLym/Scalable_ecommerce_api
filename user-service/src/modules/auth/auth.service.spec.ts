import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthProvider, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  DatabaseException,
  EmailNotVerifiedException,
  InvalidCredentialsException,
} from '../../common/exceptions/custom-exception';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.dto';

// bcrypt is replaced by a deterministic fake (see beforeEach): fast, no native binding.
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
// The real EmailService pulls in the mailer module; only its class token is needed here.
jest.mock('../../email/email.service', () => ({
  EmailService: class EmailService {},
}));

const bcryptMock = bcrypt as unknown as { hash: jest.Mock; compare: jest.Mock };

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userAuditLog: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const jwtMock = {
    sign: jest.fn(),
    decode: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const emailMock = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendPasswordChangedEmail: jest.fn(),
  };

  const ENV_KEYS = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_REFRESH_EXPIRES_IN',
    'JWT_ACCESS_EXPIRES_IN',
  ];
  let savedEnv: Record<string, string | undefined>;

  const USER = {
    id: 'u1',
    email: 'ana@example.com',
    password: 'hashed(Secret123)',
    role: 'USER',
    emailVerified: true,
    deletedAt: null,
  };

  /** Asserts `actual` is roughly `ttlMs` after the moment the call was made. */
  function expectExpiresIn(
    actual: Date,
    ttlMs: number,
    before: number,
    after: number,
  ) {
    expect(actual.getTime()).toBeGreaterThanOrEqual(before + ttlMs);
    expect(actual.getTime()).toBeLessThanOrEqual(after + ttlMs);
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    // The service logs tokens/payloads with console.* in a few places
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

    savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.JWT_ACCESS_EXPIRES_IN;

    // Transactions run their callback against the same mock
    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prismaMock),
    );

    // Deterministic bcrypt fake: a hash matches only the plain text it was made from
    bcryptMock.hash.mockImplementation(async (plain: string) => `hashed(${plain})`);
    bcryptMock.compare.mockImplementation(
      async (plain: string, hash: string) => hash === `hashed(${plain})`,
    );

    jwtMock.sign.mockImplementation((payload: { tokenType?: string }) =>
      payload.tokenType === 'refresh' ? 'refresh-token' : 'access-token',
    );
    jwtMock.decode.mockReturnValue({});

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: EmailService, useValue: emailMock },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  // ---------------------------------------------------------------- login
  describe('login', () => {
    const dto = { email: USER.email, password: 'Secret123' } as LoginUserDto;

    beforeEach(() => {
      prismaMock.user.findFirst.mockResolvedValue(USER);
    });

    it('returns both tokens and only the public user fields', async () => {
      const result = await service.login(dto, '1.2.3.4', 'jest-agent');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'u1', email: USER.email, role: 'USER' },
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it('only looks up users that are not soft-deleted', async () => {
      await service.login(dto);

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { email: dto.email, deletedAt: null },
      });
    });

    it('signs the access and refresh tokens with their own secrets and a shared jti', async () => {
      await service.login(dto);

      expect(jwtMock.sign).toHaveBeenCalledTimes(2);
      expect(jwtMock.sign).toHaveBeenNthCalledWith(
        1,
        { sub: 'u1', email: USER.email, role: 'USER', jti: expect.any(String) },
        { secret: 'test-access-secret', expiresIn: '15m' },
      );
      expect(jwtMock.sign).toHaveBeenNthCalledWith(
        2,
        {
          sub: 'u1',
          email: USER.email,
          role: 'USER',
          jti: expect.any(String),
          tokenType: 'refresh',
        },
        { secret: 'test-refresh-secret', expiresIn: '7d' },
      );
      const accessJti = jwtMock.sign.mock.calls[0][0].jti;
      const refreshJti = jwtMock.sign.mock.calls[1][0].jti;
      expect(refreshJti).toBe(accessJti);
    });

    it('stores the session with a HASHED refresh token and the same jti', async () => {
      const before = Date.now();
      await service.login(dto, '1.2.3.4', 'jest-agent');
      const after = Date.now();

      const { data } = prismaMock.userSession.create.mock.calls[0][0];
      expect(data).toMatchObject({
        userId: 'u1',
        token: 'access-token',
        refreshToken: 'hashed(refresh-token)',
        ipAddress: '1.2.3.4',
        userAgent: 'jest-agent',
      });
      expect(data.refreshToken).not.toBe('refresh-token');
      expect(data.accessJti).toBe(jwtMock.sign.mock.calls[0][0].jti);
      expectExpiresIn(data.expiresAt, SEVEN_DAYS, before, after);
    });

    it('records last login and both audit entries in a single transaction', async () => {
      await service.login(dto, '1.2.3.4', 'jest-agent');

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { lastLoginAt: expect.any(Date), lastLoginIp: '1.2.3.4' },
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', action: 'LOGIN_SUCCESS' }),
      });
      expect(prismaMock.userAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', action: 'LOGIN' }),
      });
    });

    it.each([
      ['30m', 30 * 60 * 1000],
      ['2h', 2 * ONE_HOUR],
      ['1d', ONE_DAY],
      ['45s', 45 * 1000],
    ])('honours JWT_REFRESH_EXPIRES_IN=%s for the session expiry', async (value, ttl) => {
      process.env.JWT_REFRESH_EXPIRES_IN = value;

      const before = Date.now();
      await service.login(dto);
      const after = Date.now();

      const { data } = prismaMock.userSession.create.mock.calls[0][0];
      expectExpiresIn(data.expiresAt, ttl, before, after);
    });

    it('falls back to 7 days when JWT_REFRESH_EXPIRES_IN is malformed', async () => {
      process.env.JWT_REFRESH_EXPIRES_IN = 'forever';

      const before = Date.now();
      await service.login(dto);
      const after = Date.now();

      const { data } = prismaMock.userSession.create.mock.calls[0][0];
      expectExpiresIn(data.expiresAt, SEVEN_DAYS, before, after);
    });

    it('rejects an unknown email without creating a session', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        InvalidCredentialsException,
      );
      expect(prismaMock.userSession.create).not.toHaveBeenCalled();
    });

    it('rejects accounts without a local password (OAuth) without comparing hashes', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ ...USER, password: null });

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        InvalidCredentialsException,
      );
      expect(bcryptMock.compare).not.toHaveBeenCalled();
    });

    it('rejects a wrong password without creating a session', async () => {
      await expect(
        service.login({ ...dto, password: 'Wrong123' } as LoginUserDto),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);

      expect(bcryptMock.compare).toHaveBeenCalledWith('Wrong123', USER.password);
      expect(prismaMock.userSession.create).not.toHaveBeenCalled();
    });

    it('rejects unverified emails and does not issue tokens', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ ...USER, emailVerified: false });

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        EmailNotVerifiedException,
      );
      expect(jwtMock.sign).not.toHaveBeenCalled();
      expect(prismaMock.userSession.create).not.toHaveBeenCalled();
    });

    it('wraps unexpected database failures in a 500 DatabaseException', async () => {
      prismaMock.$transaction.mockRejectedValue(new Error('connection lost'));

      const error = await service.login(dto).catch((e) => e);

      expect(error).toBeInstanceOf(DatabaseException);
      expect(error.getStatus()).toBe(500);
    });

    it('fails with a 500 and creates no session when no JWT secret is configured', async () => {
      delete process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_SECRET;

      const error = await service.login(dto).catch((e) => e);

      expect(error.getStatus()).toBe(500);
      expect(prismaMock.userSession.create).not.toHaveBeenCalled();
    });

    it.todo(
      'does not reveal whether an email is verified before the password is checked (account enumeration)',
    );
  });

  // -------------------------------------------------------------- refresh
  describe('refresh', () => {
    const OLD = 'old-refresh-token';
    const currentSession = { id: 's-current', userId: 'u1', refreshToken: `hashed(${OLD})` };
    const otherSession = { id: 's-other', userId: 'u1', refreshToken: 'hashed(other-token)' };

    beforeEach(() => {
      jwtMock.verifyAsync.mockResolvedValue({ sub: 'u1', tokenType: 'refresh' });
      prismaMock.userSession.findMany.mockResolvedValue([otherSession, currentSession]);
      prismaMock.user.findFirst.mockResolvedValue(USER);
    });

    it('rotates the tokens and updates the matching session', async () => {
      const before = Date.now();
      const result = await service.refresh(OLD);
      const after = Date.now();

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
      expect(jwtMock.verifyAsync).toHaveBeenCalledWith(OLD, {
        secret: 'test-refresh-secret',
      });

      // Picks the second session (the one whose hash matches), not the first
      const { where, data } = prismaMock.userSession.update.mock.calls[0][0];
      expect(where).toEqual({ id: 's-current' });
      expect(data).toMatchObject({
        token: 'access-token',
        refreshToken: 'hashed(refresh-token)',
        lastActiveAt: expect.any(Date),
      });
      expect(data.accessJti).toBe(jwtMock.sign.mock.calls[0][0].jti);
      expectExpiresIn(data.expiresAt, SEVEN_DAYS, before, after);
    });

    it('only considers sessions that are active and not expired', async () => {
      await service.refresh(OLD);

      expect(prismaMock.userSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('skips sessions that have no refresh token stored', async () => {
      prismaMock.userSession.findMany.mockResolvedValue([
        { id: 's-null', userId: 'u1', refreshToken: null },
        currentSession,
      ]);

      await service.refresh(OLD);

      expect(bcryptMock.compare).toHaveBeenCalledTimes(1);
      expect(prismaMock.userSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's-current' } }),
      );
    });

    it.each(['TokenExpiredError', 'JsonWebTokenError'])(
      'turns a %s into a 401 and never touches the database',
      async (name) => {
        jwtMock.verifyAsync.mockRejectedValue(Object.assign(new Error('x'), { name }));

        await expect(service.refresh(OLD)).rejects.toBeInstanceOf(UnauthorizedException);
        expect(prismaMock.userSession.findMany).not.toHaveBeenCalled();
      },
    );

    it('rethrows verification errors it does not recognise', async () => {
      const boom = new Error('boom');
      jwtMock.verifyAsync.mockRejectedValue(boom);

      await expect(service.refresh(OLD)).rejects.toBe(boom);
    });

    it('rejects a token without a subject', async () => {
      jwtMock.verifyAsync.mockResolvedValue({ tokenType: 'refresh' });

      await expect(service.refresh(OLD)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token that is not a refresh token', async () => {
      jwtMock.verifyAsync.mockResolvedValue({ sub: 'u1', tokenType: 'access' });

      await expect(service.refresh(OLD)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaMock.userSession.findMany).not.toHaveBeenCalled();
    });

    it('rejects a token with no matching active session (revoked or already rotated)', async () => {
      prismaMock.userSession.findMany.mockResolvedValue([otherSession]);

      await expect(service.refresh(OLD)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaMock.userSession.update).not.toHaveBeenCalled();
    });

    it('rejects when the user was soft-deleted', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.refresh(OLD)).rejects.toThrow('User not found');
      expect(prismaMock.userSession.update).not.toHaveBeenCalled();
    });

    it('verifies with the same fallback secret login() signs with', async () => {
      delete process.env.JWT_REFRESH_SECRET;

      await service.refresh(OLD);

      expect(jwtMock.verifyAsync).toHaveBeenCalledWith(OLD, {
        secret: 'test-access-secret',
      });
    });

    it('fails with a 500 when no JWT secret is configured at all', async () => {
      delete process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_SECRET;

      await expect(service.refresh(OLD)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(prismaMock.userSession.findMany).not.toHaveBeenCalled();
    });

    it.todo(
      'revokes every session of the user when an already-rotated refresh token is reused (token theft detection)',
    );
  });

  // --------------------------------------------------------------- logout
  describe('logout', () => {
    const TOKEN = 'refresh-to-revoke';

    beforeEach(() => {
      jwtMock.verifyAsync.mockResolvedValue({ sub: 'u1' });
      prismaMock.userSession.findMany.mockResolvedValue([
        { id: 's-current', userId: 'u1', refreshToken: `hashed(${TOKEN})` },
      ]);
    });

    it('revokes the session that owns the refresh token', async () => {
      await expect(service.logout(TOKEN)).resolves.toEqual({ ok: true });

      expect(prismaMock.userSession.update).toHaveBeenCalledWith({
        where: { id: 's-current' },
        data: { revokedAt: expect.any(Date), lastActiveAt: expect.any(Date) },
      });
    });

    it('is idempotent for an invalid token: succeeds and revokes nothing', async () => {
      jwtMock.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

      await expect(service.logout(TOKEN)).resolves.toEqual({ ok: true });
      expect(prismaMock.userSession.findMany).not.toHaveBeenCalled();
      expect(prismaMock.userSession.update).not.toHaveBeenCalled();
    });

    it('succeeds without a lookup when the token has no subject', async () => {
      jwtMock.verifyAsync.mockResolvedValue({});

      await expect(service.logout(TOKEN)).resolves.toEqual({ ok: true });
      expect(prismaMock.userSession.findMany).not.toHaveBeenCalled();
    });

    it('succeeds when the session was already revoked or does not exist', async () => {
      prismaMock.userSession.findMany.mockResolvedValue([]);

      await expect(service.logout(TOKEN)).resolves.toEqual({ ok: true });
      expect(prismaMock.userSession.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------- verifyEmail
  describe('verifyEmail', () => {
    it('marks the email as verified, clears the token and writes an audit entry', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' });

      const result = await service.verifyEmail('verify-token');

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          verificationToken: 'verify-token',
          verificationExpiresAt: { gt: expect.any(Date) },
        },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          emailVerified: true,
          emailVerifiedAt: expect.any(Date),
          verificationToken: null,
          verificationExpiresAt: null,
          status: 'ACTIVE',
        },
      });
      expect(prismaMock.userAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1' }),
      });
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    it('rejects an unknown or expired token without changing anything', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('nope')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(prismaMock.userAuditLog.create).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------- create
  describe('create (registration)', () => {
    const data = {
      email: 'new@example.com',
      password: 'Secret123',
      firstName: 'Ana',
      lastName: 'Perez',
    };

    beforeEach(() => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      // Echo what would be persisted, including secrets, to prove the response strips them
      prismaMock.user.create.mockImplementation(async ({ data: d }) => ({
        id: 'u-new',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...d,
        profile: d.profile.create,
      }));
    });

    it('stores a bcrypt hash and never the plain password', async () => {
      await service.create(data, '1.2.3.4', 'jest-agent');

      expect(bcryptMock.hash).toHaveBeenCalledWith('Secret123', 10);
      const { data: persisted } = prismaMock.user.create.mock.calls[0][0];
      expect(persisted.password).toBe('hashed(Secret123)');
    });

    it('creates an unverified LOCAL/USER account with a profile and a 24h verification token', async () => {
      const before = Date.now();
      await service.create(data, '1.2.3.4');
      const after = Date.now();

      const { data: persisted } = prismaMock.user.create.mock.calls[0][0];
      expect(persisted).toMatchObject({
        email: 'new@example.com',
        authProvider: AuthProvider.LOCAL,
        role: Role.USER,
        emailVerified: false,
        profile: {
          create: { firstName: 'Ana', lastName: 'Perez', fullName: 'Ana Perez' },
        },
      });
      expect(persisted.verificationToken).toMatch(/^[0-9a-f]{64}$/);
      expectExpiresIn(persisted.verificationExpiresAt, ONE_DAY, before, after);
    });

    it('writes a REGISTER audit entry with ip and user agent', async () => {
      await service.create(data, '1.2.3.4', 'jest-agent');

      expect(prismaMock.userAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-new',
          action: 'REGISTER',
          ipAddress: '1.2.3.4',
          userAgent: 'jest-agent',
        },
      });
    });

    it('emails the same verification token it stored', async () => {
      await service.create(data, '1.2.3.4');

      const { data: persisted } = prismaMock.user.create.mock.calls[0][0];
      expect(emailMock.sendVerificationEmail).toHaveBeenCalledWith(
        'new@example.com',
        persisted.verificationToken,
        'Ana Perez',
      );
    });

    it('returns a sanitized response without password or verification token', async () => {
      const result = await service.create(data, '1.2.3.4');

      expect(result).toMatchObject({ id: 'u-new', email: 'new@example.com', role: 'USER' });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('verificationToken');
      expect(result).not.toHaveProperty('verificationExpiresAt');
    });

    it('rejects an email that is already registered (ignoring soft-deleted users)', async () => {
      prismaMock.user.findFirst.mockResolvedValue(USER);

      await expect(service.create(data, '1.2.3.4')).rejects.toThrow('User already exists');

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { email: data.email, deletedAt: null },
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(emailMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('requires a password for LOCAL accounts', async () => {
      const { password, ...withoutPassword } = data;

      await expect(service.create(withoutPassword, '1.2.3.4')).rejects.toThrow(
        'Password is required',
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('creates OAuth accounts without hashing anything', async () => {
      const { password, ...oauth } = data;

      await service.create({ ...oauth, authProvider: AuthProvider.GITHUB }, '1.2.3.4');

      expect(bcryptMock.hash).not.toHaveBeenCalled();
      const { data: persisted } = prismaMock.user.create.mock.calls[0][0];
      expect(persisted.password).toBeNull();
      expect(persisted.authProvider).toBe(AuthProvider.GITHUB);
    });

    it.each([
      ['no name at all', {}, 'usuario'],
      ['only a first name', { firstName: 'Ana' }, 'Ana'],
      ['blank names', { firstName: '  ', lastName: ' ' }, 'usuario'],
    ])('addresses the verification email correctly with %s', async (_label, names, expected) => {
      await service.create(
        { email: 'anon@example.com', password: 'Secret123', ...names },
        '1.2.3.4',
      );

      expect(emailMock.sendVerificationEmail).toHaveBeenCalledWith(
        'anon@example.com',
        expect.any(String),
        expected,
      );
    });

    // POST /auth/register is public and RegisterDto accepts `role`: it must never be honoured
    it('ignores a client-supplied role on public registration', async () => {
      await service.create({ ...data, role: Role.ADMIN }, '1.2.3.4');

      const { data: persisted } = prismaMock.user.create.mock.calls[0][0];
      expect(persisted.role).toBe(Role.USER);
    });

    it.todo('still completes registration when the verification email cannot be sent');
  });

  // ---------------------------------------------- findByEmail / validateUser
  describe('validateUser', () => {
    it('returns the user without the password when credentials match', async () => {
      prismaMock.user.findFirst.mockResolvedValue(USER);

      const result = await service.validateUser(USER.email, 'Secret123');

      expect(result).toEqual({
        id: 'u1',
        email: USER.email,
        role: 'USER',
        emailVerified: true,
        deletedAt: null,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('returns null for a wrong password', async () => {
      prismaMock.user.findFirst.mockResolvedValue(USER);

      await expect(service.validateUser(USER.email, 'Wrong123')).resolves.toBeNull();
    });

    it('returns null for an unknown email', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.validateUser('ghost@example.com', 'Secret123')).resolves.toBeNull();
    });

    it('returns null for OAuth accounts without calling bcrypt', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ ...USER, password: null });

      await expect(service.validateUser(USER.email, 'Secret123')).resolves.toBeNull();
      expect(bcryptMock.compare).not.toHaveBeenCalled();
    });

    it('only looks up users that are not soft-deleted', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await service.validateUser(USER.email, 'Secret123');

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { email: USER.email, deletedAt: null },
      });
    });
  });

  // ---------------------------------------------------------- findByToken
  describe('findByToken', () => {
    const BEARER = 'Bearer abc123';

    beforeEach(() => {
      jwtMock.verifyAsync.mockResolvedValue({ sub: 'u1' });
      prismaMock.userSession.findFirst.mockResolvedValue({ id: 's1', userId: 'u1' });
      prismaMock.user.findFirst.mockResolvedValue({
        ...USER,
        profile: { fullName: 'Ana Perez' },
      });
    });

    it('resolves the user that owns a valid, non-revoked bearer token', async () => {
      const result = await service.findByToken(BEARER);

      expect(jwtMock.verifyAsync).toHaveBeenCalledWith('abc123', {
        secret: 'test-access-secret',
      });
      expect(prismaMock.userSession.findFirst).toHaveBeenCalledWith({
        where: { token: 'abc123', userId: 'u1', revokedAt: null },
      });
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', deletedAt: null },
        include: { profile: true },
      });
      expect(result).toMatchObject({ id: 'u1', email: USER.email });
    });

    it('never returns the password hash', async () => {
      const result = await service.findByToken(BEARER);

      expect(result).not.toHaveProperty('password');
    });

    it.each([
      ['an empty header', ''],
      ['a header without the Bearer scheme', 'abc123'],
      ['a different scheme', 'Basic abc123'],
      ['a Bearer header with no token', 'Bearer '],
      ['a Bearer header with only spaces', 'Bearer    '],
    ])('rejects %s without verifying anything', async (_label, header) => {
      await expect(service.findByToken(header)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwtMock.verifyAsync).not.toHaveBeenCalled();
    });

    it('rejects a token that fails JWT verification before touching the database', async () => {
      jwtMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.findByToken(BEARER)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prismaMock.userSession.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a verified token that has no subject', async () => {
      jwtMock.verifyAsync.mockResolvedValue({});

      await expect(service.findByToken(BEARER)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prismaMock.userSession.findFirst).not.toHaveBeenCalled();
    });

    // Regression: this used to query `where: { id: undefined }`, which Prisma treats
    // as "no filter" and returned an arbitrary user.
    it('rejects when no active session matches and never loads a user', async () => {
      prismaMock.userSession.findFirst.mockResolvedValue(null);

      await expect(service.findByToken(BEARER)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    });

    it('rejects when the user was soft-deleted', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.findByToken(BEARER)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // ------------------------------------------------ sendPasswordResetEmail
  describe('sendPasswordResetEmail', () => {
    it('issues a 1h reset token, stores it and emails it', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...USER,
        profile: { fullName: 'Ana Perez' },
      });
      jwtMock.sign.mockReturnValue('reset-token');

      const before = Date.now();
      await service.sendPasswordResetEmail(USER.email);
      const after = Date.now();

      expect(jwtMock.sign).toHaveBeenCalledWith(
        { sub: 'u1', email: USER.email, type: 'password-reset' },
        { expiresIn: '1h' },
      );
      const { where, data } = prismaMock.user.update.mock.calls[0][0];
      expect(where).toEqual({ id: 'u1' });
      expect(data.passwordResetToken).toBe('reset-token');
      expectExpiresIn(data.passwordResetExpiresAt, ONE_HOUR, before, after);
      expect(emailMock.sendPasswordResetEmail).toHaveBeenCalledWith(
        USER.email,
        'reset-token',
        'Ana Perez',
      );
    });

    it('does nothing and does not reveal it when the email is unknown', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.sendPasswordResetEmail('ghost@example.com')).resolves.toBeUndefined();

      expect(jwtMock.sign).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(emailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------- resetPassword
  describe('resetPassword', () => {
    const TOKEN = 'reset-token';
    const NEW_PASSWORD = 'NewPass123';
    const metadata = { requestIp: '9.9.9.9', userAgent: 'jest-agent', location: 'Mendoza' };

    beforeEach(() => {
      jwtMock.verifyAsync.mockResolvedValue({ sub: 'u1', type: 'password-reset' });
      prismaMock.user.findFirst.mockResolvedValue({
        ...USER,
        profile: { fullName: 'Ana Perez' },
      });
    });

    it('verifies the token and looks up a user whose reset token is still valid', async () => {
      await service.resetPassword(TOKEN, NEW_PASSWORD, metadata);

      expect(jwtMock.verifyAsync).toHaveBeenCalledWith(TOKEN, {
        secret: 'test-access-secret',
      });
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'u1',
          passwordResetToken: TOKEN,
          passwordResetExpiresAt: { gt: expect.any(Date) },
        },
        include: { profile: true },
      });
    });

    it('saves the hashed password, burns the reset token and revokes every active session', async () => {
      const result = await service.resetPassword(TOKEN, NEW_PASSWORD, metadata);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          password: 'hashed(NewPass123)',
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', action: 'PASSWORD_RESET_SUCCESS' }),
      });
      expect(result.success).toBe(true);
    });

    it('notifies the user by email with the request metadata', async () => {
      await service.resetPassword(TOKEN, NEW_PASSWORD, metadata);

      expect(emailMock.sendPasswordChangedEmail).toHaveBeenCalledWith(
        USER.email,
        'Ana Perez',
        { ip: '9.9.9.9', device: 'jest-agent', location: 'Mendoza' },
      );
    });

    it('still succeeds if the confirmation email fails', async () => {
      emailMock.sendPasswordChangedEmail.mockRejectedValue(new Error('smtp down'));

      const result = await service.resetPassword(TOKEN, NEW_PASSWORD, metadata);

      expect(result.success).toBe(true);
    });

    it.each(['TokenExpiredError', 'JsonWebTokenError'])(
      'rejects a token that fails verification (%s) before touching the database',
      async (name) => {
        jwtMock.verifyAsync.mockRejectedValue(Object.assign(new Error('x'), { name }));

        await expect(
          service.resetPassword(TOKEN, NEW_PASSWORD, metadata),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
      },
    );

    it('rejects a valid JWT that is not a password-reset token', async () => {
      jwtMock.verifyAsync.mockResolvedValue({ sub: 'u1', type: 'access' });

      await expect(
        service.resetPassword(TOKEN, NEW_PASSWORD, metadata),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a token that was already used or replaced', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword(TOKEN, NEW_PASSWORD, metadata),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['too short', 'Ab1'],
      ['no uppercase letter', 'alllowercase1'],
      ['no lowercase letter', 'ALLUPPERCASE1'],
      ['no digit', 'NoDigitsHere'],
    ])('rejects a weak password (%s) and changes nothing', async (_reason, weak) => {
      await expect(
        service.resetPassword(TOKEN, weak, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(bcryptMock.hash).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('maps unexpected failures to a generic 500 instead of leaking internals', async () => {
      prismaMock.$transaction.mockRejectedValue(new Error('deadlock detected'));

      await expect(
        service.resetPassword(TOKEN, NEW_PASSWORD, metadata),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
