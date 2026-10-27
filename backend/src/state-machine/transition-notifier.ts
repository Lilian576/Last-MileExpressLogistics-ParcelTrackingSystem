import { ParcelStatus } from '@prisma/client';
import { TransitionActor } from './state-machine.types';

/** Integration contract for M2; call only after the database commit succeeds. */
export interface TransitionNotifier {
  onTransition(
    parcelId: string,
    from: ParcelStatus | null,
    to: ParcelStatus,
    actor: TransitionActor,
  ): Promise<void>;
}

export type PublicParcelStatus =
  | 'Order Placed'
  | 'Received'
  | 'In-Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Being Returned'
  | 'Returned'
  | 'Cancelled'
  | 'Delayed';

/** Public snapshot notification; excludes internal status, actors and PII. */
export interface ParcelStatusUpdatedPayload {
  trackingCode: string;
  status: PublicParcelStatus;
  /** ISO 8601 timestamp from the persisted parcel snapshot. */
  updatedAt: string;
}

export interface ParcelDeliveryCompletedPayload
  extends ParcelStatusUpdatedPayload {
  status: 'Delivered';
}
