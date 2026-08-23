import { IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsNotEmpty({ message: 'full_name is required' })
  fullName: string;

  @IsEmail({}, { message: 'email must be a valid email' })
  email: string;

  @IsNotEmpty({ message: 'phone is required' })
  phone: string;

  @MinLength(6, { message: 'password must be at least 6 characters' })
  password: string;

  @IsEnum(Role, { message: 'role must be one of: customer, shipper, warehouse_staff, admin' })
  role: Role;
}
