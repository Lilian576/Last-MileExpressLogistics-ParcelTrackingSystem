import { ConfigService } from '@nestjs/config';

export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.getOrThrow<string>('JWT_SECRET');
  if (!secret.trim() || secret.trim() === 'change-me-in-env') {
    throw new Error('JWT_SECRET must be set to a private signing key');
  }
  return secret;
}
