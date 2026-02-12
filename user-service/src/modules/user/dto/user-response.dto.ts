import { Expose } from 'class-transformer';
import { Role, AuthProvider } from '@prisma/client';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  role: Role;

  @Expose()
  authProvider: AuthProvider;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  profile?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
}
