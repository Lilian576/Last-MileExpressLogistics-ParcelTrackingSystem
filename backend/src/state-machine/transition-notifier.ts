import { ParcelStatus } from '@prisma/client';
import type { ParcelStatusUpdatePayload } from '../tracking/tracking.gateway';
import { TransitionActor } from './state-machine.types';

export interface TransitionNotifier {
  onTransition(
    parcelId: string,
    from: ParcelStatus | null,
    to: ParcelStatus,
    actor: TransitionActor,
    notification: { id: string; update: ParcelStatusUpdatePayload },
  ): Promise<void>;
}
