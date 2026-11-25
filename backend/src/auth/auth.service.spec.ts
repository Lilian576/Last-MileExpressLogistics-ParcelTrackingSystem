import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    fullName: 'Test Customer',
    email: 'customer@example.test',
    role: Role.customer,
    isActive: true,
  };
  const dto = {
    fullName: user.fullName,
    email: user.email,
    phone: '0900000000',
    password: 'example-password',
  };
  const prisma = {
    user: {
      create: jest.fn<Promise<typeof user>, [Prisma.UserCreateArgs]>(),
      findUnique: jest.fn(),
    },
  };
  const jwt = { sign: jest.fn() };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('always registers a customer even when an admin role is injected', async () => {
    prisma.user.create.mockResolvedValue(user);
    jwt.sign.mockReturnValue('signed-token');
    const submitted = { ...dto, role: Role.admin };

    await expect(service.register(submitted)).resolves.toMatchObject({
      accessToken: 'signed-token',
      user: { role: Role.customer },
    });
    expect(prisma.user.create.mock.calls[0]?.[0].data.role).toBe(Role.customer);
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.customer }),
    );
  });

  it('maps a duplicate email or phone from the database to a conflict', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('rejects the wrong password without signing a token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash('different-password', 4),
    });

    await expect(service.login(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
