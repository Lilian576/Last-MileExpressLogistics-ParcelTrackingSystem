import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { TransitionEvent } from '../state-machine/state-machine.types';

// Chỉ nhận event + các cờ không thể suy ra từ DB. Các giá trị khác (isAssignedCourier,
// failedAttemptCount, hoursSinceLastUpdate...) server tự lấy từ DB — client gửi cũng bị bỏ.
export class UpdateParcelStatusDto {
  @IsEnum(TransitionEvent)
  event: TransitionEvent;

  @IsOptional()
  @IsBoolean()
  isHubLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinalHub?: boolean;

  @IsOptional()
  @IsBoolean()
  hasDeliveryProof?: boolean;
}
