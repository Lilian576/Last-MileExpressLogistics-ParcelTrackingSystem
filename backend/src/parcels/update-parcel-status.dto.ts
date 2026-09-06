import { TransitionEvent } from '../state-machine/state-machine.types';

export class UpdateParcelStatusDto {
  event: TransitionEvent;

  // Các field này optional — chỉ cần điền đúng cái mà event đó yêu cầu guard kiểm tra
  hasAvailableCourier?: boolean;
  isAssignedCourier?: boolean;
  isHubLocation?: boolean;
  isFinalHub?: boolean;
  hoursSinceLastUpdate?: number;
  hasDeliveryProof?: boolean;
  failedAttemptCount?: number;
  maxRetryAttempts?: number;
}