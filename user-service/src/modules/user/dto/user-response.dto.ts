import { Exclude, Expose } from 'class-transformer';

export class RegisterUserDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  role: string;

  @Expose()
  status: string;

  @Expose()
  firstName?: string;

  @Expose()
  lastName?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // Nunca exponer password
  @Exclude()
  password: string;

  constructor(partial: Partial<RegisterUserDto>) {
    Object.assign(this, partial);
  }
}
