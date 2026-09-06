import { IsEnum, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { TransitionEvent } from '../state-machine/state-machine.types';

export class UpdateParcelStatusDto {
  @IsEnum(TransitionEvent)
  event: TransitionEvent;

  @IsOptional()
  @IsBoolean()
  hasAvailableCourier?: boolean;

  @IsOptional()
  @IsBoolean()
  isAssignedCourier?: boolean;

  @IsOptional()
  @IsBoolean()
  isHubLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinalHub?: boolean;

  @IsOptional()
  @IsNumber()
  hoursSinceLastUpdate?: number;

  @IsOptional()
  @IsBoolean()
  hasDeliveryProof?: boolean;

  @IsOptional()
  @IsNumber()
  failedAttemptCount?: number;

  @IsOptional()
  @IsNumber()
  maxRetryAttempts?: number;
}