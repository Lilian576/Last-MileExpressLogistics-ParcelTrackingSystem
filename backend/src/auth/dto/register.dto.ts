import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'full_name is required' })
  fullName: string;

  @IsEmail({}, { message: 'email must be a valid email' })
  email: string;

  @IsNotEmpty({ message: 'phone is required' })
  phone: string;

  @MinLength(6, { message: 'password must be at least 6 characters' })
  password: string;
}
