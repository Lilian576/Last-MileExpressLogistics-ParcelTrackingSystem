import { ParcelStatus } from '@prisma/client';
import { TransitionActor } from './state-machine.types';

/** Integration contract for M2; call only after the database commit succeeds. */
export interface TransitionNotifier {
  onTransition(
    parcelId: string,
    from: ParcelStatus | null,
    to: ParcelStatus,
    actor: TransitionActor,
    notification: { id: string; update: ParcelStatusUpdatedPayload },
  ): Promise<void>;
}

/** Wire format already consumed by M1 and emitted by TrackingGateway. */
export interface ParcelStatusUpdatedPayload {
  trackingCode: string;
  currentStatus: ParcelStatus;
  event: {
    status: ParcelStatus;
    /** ISO 8601 UTC, from the committed history row. */
    timestamp: string;
    note?: string;
  };
}

export interface ParcelDeliveryCompletedPayload extends ParcelStatusUpdatedPayload {
  currentStatus: 'DELIVERED';
}

export interface ParcelLocationUpdatedPayload {
  trackingCode: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

/** B03 handoff contract. Sending and signing are implemented by M2. */
export interface ParcelStatusWebhookPayload {
  eventId: string;
  type: 'parcel.status.updated';
  occurredAt: string;
  data: ParcelStatusUpdatedPayload;
}
