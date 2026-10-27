import { ParcelStatus } from '@prisma/client';
import { TransitionEvent } from './state-machine.types';

/** Integration contract for M2; call only after the database commit succeeds. */
export interface CommittedParcelTransition {
  /** Persisted history ID; consumers use this to deduplicate retries. */
  eventId: string;
  parcelId: string;
  trackingCode: string;
  from: ParcelStatus | null;
  to: ParcelStatus;
  trigger: TransitionEvent;
  occurredAt: string;
  locationId?: string;
}

export interface TransitionNotifier {
  onTransition(event: CommittedParcelTransition): Promise<void>;
}
