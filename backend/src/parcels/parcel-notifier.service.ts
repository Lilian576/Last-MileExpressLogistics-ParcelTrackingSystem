import { createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParcelStatus } from '@prisma/client';
import { TransitionActor } from '../state-machine/state-machine.types';
import { TransitionNotifier } from '../state-machine/transition-notifier';
import {
  ParcelStatusUpdatePayload,
  TrackingGateway,
} from '../tracking/tracking.gateway';

@Injectable()
export class ParcelNotifierService implements TransitionNotifier {
  private readonly logger = new Logger(ParcelNotifierService.name);
  private readonly webhookUrl?: URL;
  private readonly webhookSecret?: string;

  constructor(
    private readonly tracking: TrackingGateway,
    config: ConfigService,
  ) {
    const url = config.get<string>('PARCEL_WEBHOOK_URL')?.trim();
    if (!url) return;
    this.webhookSecret = config.get<string>('PARCEL_WEBHOOK_SECRET')?.trim();
    this.webhookUrl = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(
      this.webhookUrl.hostname,
    );
    if (
      !this.webhookSecret ||
      this.webhookUrl.username ||
      this.webhookUrl.password ||
      (this.webhookUrl.protocol !== 'https:' &&
        !(local && this.webhookUrl.protocol === 'http:'))
    ) {
      throw new Error(
        'Cấu hình PARCEL_WEBHOOK_URL hoặc PARCEL_WEBHOOK_SECRET không hợp lệ',
      );
    }
  }

  async onTransition(
    parcelId: string,
    from: ParcelStatus | null,
    to: ParcelStatus,
    actor: TransitionActor,
    notification: { id: string; update: ParcelStatusUpdatePayload },
  ): Promise<void> {
    try {
      this.tracking.emitStatusUpdated(notification.update);
    } catch {
      this.logger.warn(`Không phát được sự kiện Socket.IO ${notification.id}`);
    }

    if (!this.webhookUrl || !this.webhookSecret) return;
    const body = JSON.stringify({
      id: notification.id,
      type: 'parcel.status.updated',
      parcelId,
      trackingCode: notification.update.trackingCode,
      previousStatus: from,
      status: to,
      actor,
      occurredAt: notification.update.event.timestamp,
    });
    const signature = createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-parcel-signature': `sha256=${signature}`,
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(2000),
      });
      await response.body?.cancel();
      if (!response.ok) {
        this.logger.warn(
          `Webhook ${notification.id} trả HTTP ${response.status}`,
        );
      }
    } catch {
      this.logger.warn(`Không gửi được webhook ${notification.id}`);
    }
  }
}
