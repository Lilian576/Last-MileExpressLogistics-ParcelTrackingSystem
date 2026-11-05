import { Logger, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ParcelStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

// Hợp đồng event với Frontend (xem Frontend/README.md, mục "Hợp đồng WebSocket")
export const TRACKING_EVENTS = {
  STATUS_UPDATED: 'parcel.status.updated',
  DELIVERY_COMPLETED: 'parcel.delivery.completed',
  LOCATION_UPDATED: 'parcel.location.updated',
} as const;

// Payload phát cho room tracking mỗi khi tài xế gửi vị trí (event driver:location)
export interface ParcelLocationPayload {
  trackingCode: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

// Giới hạn số message mỗi socket: tối đa WS_RATE_MAX_MESSAGES trong WS_RATE_WINDOW_MS
const WS_RATE_WINDOW_MS = 10_000;
const WS_RATE_MAX_MESSAGES = 30;

export interface ParcelStatusUpdatePayload {
  trackingCode: string;
  currentStatus: ParcelStatus;
  event: { status: ParcelStatus; timestamp: string; note?: string };
}

export const parcelRoom = (trackingCode: string) => `parcel:${trackingCode}`;

function readTrackingCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const code = (body as { trackingCode?: unknown }).trackingCode;
  if (typeof code !== 'string') return null;
  const trimmed = code.trim();
  return trimmed.length > 0 && trimmed.length <= 64 ? trimmed : null;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class TrackingGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private readonly buckets = new WeakMap<
    Socket,
    { count: number; resetAt: number }
  >();

  // JwtService / PrismaService là @Optional để gateway vẫn dựng được trong test thuần WebSocket;
  // thiếu một trong hai thì event driver:location bị từ chối.
  constructor(
    @Optional() private readonly jwt?: JwtService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  private allow(client: Socket): boolean {
    const now = Date.now();
    const b = this.buckets.get(client);
    if (!b || now >= b.resetAt) {
      this.buckets.set(client, { count: 1, resetAt: now + WS_RATE_WINDOW_MS });
      return true;
    }
    b.count += 1;
    return b.count <= WS_RATE_MAX_MESSAGES;
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', 'pong tu server'); // gửi thẳng lại cho đúng client vừa gửi
  }

  // Client (trang tracking) vào room theo mã vận đơn để nhận cập nhật của đúng đơn đó
  @SubscribeMessage('join:parcel')
  async handleJoinParcel(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.allow(client)) return { ok: false, error: 'rate_limited' };
    const trackingCode = readTrackingCode(body);
    if (!trackingCode) return { ok: false, error: 'trackingCode is required' };
    await client.join(parcelRoom(trackingCode));
    return { ok: true, trackingCode };
  }

  @SubscribeMessage('leave:parcel')
  async handleLeaveParcel(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.allow(client)) return { ok: false, error: 'rate_limited' };
    const trackingCode = readTrackingCode(body);
    if (!trackingCode) return { ok: false, error: 'trackingCode is required' };
    await client.leave(parcelRoom(trackingCode));
    return { ok: true, trackingCode };
  }

  // Tài xế gửi vị trí GPS (thật hoặc giả lập, xem scripts/gps-simulator.js).
  // Cần JWT của shipper trong handshake (auth.token) và phải đang được giao đúng đơn này.
  @SubscribeMessage('driver:location')
  async handleDriverLocation(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.allow(client)) return { ok: false, error: 'rate_limited' };
    if (!this.jwt || !this.prisma) return { ok: false, error: 'unavailable' };

    const trackingCode = readTrackingCode(body);
    const { latitude, longitude } = (body ?? {}) as {
      latitude?: unknown;
      longitude?: unknown;
    };
    if (
      !trackingCode ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !(latitude >= -90 && latitude <= 90) ||
      !(longitude >= -180 && longitude <= 180)
    ) {
      return { ok: false, error: 'invalid payload' };
    }

    const token = (client.handshake.auth as { token?: unknown } | undefined)
      ?.token;
    let userId: string;
    try {
      if (typeof token !== 'string') throw new Error('no token');
      const claims = await this.jwt.verifyAsync<{ sub: string; role: string }>(
        token,
      );
      if (claims.role !== 'shipper') throw new Error('not shipper');
      userId = claims.sub;
    } catch {
      return { ok: false, error: 'unauthorized' };
    }

    const assigned = await this.prisma.deliveryAssignment.count({
      where: {
        courierId: userId,
        status: { in: ['assigned', 'accepted', 'in_progress'] },
        parcel: { trackingCode },
      },
    });
    if (assigned === 0) return { ok: false, error: 'forbidden' };

    const payload: ParcelLocationPayload = {
      trackingCode,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    };
    this.server
      .to(parcelRoom(trackingCode))
      .emit(TRACKING_EVENTS.LOCATION_UPDATED, payload);
    this.logger.debug(`GPS ${trackingCode}: ${latitude},${longitude}`);
    return { ok: true };
  }

  // Được ParcelsService gọi SAU KHI StateMachineService validate + lưu DB thành công
  emitStatusUpdated(update: ParcelStatusUpdatePayload) {
    const room = parcelRoom(update.trackingCode);
    this.server.to(room).emit(TRACKING_EVENTS.STATUS_UPDATED, update);
    if (update.currentStatus === 'DELIVERED') {
      this.server.to(room).emit(TRACKING_EVENTS.DELIVERY_COMPLETED, update);
    }
  }
}
