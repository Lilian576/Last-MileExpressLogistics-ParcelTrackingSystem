import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ParcelStatus } from '@prisma/client';

// Hợp đồng event với Frontend (xem Frontend/README.md, mục "Hợp đồng WebSocket")
export const TRACKING_EVENTS = {
  STATUS_UPDATED: 'parcel.status.updated',
  DELIVERY_COMPLETED: 'parcel.delivery.completed',
  LOCATION_UPDATED: 'parcel.location.updated',
} as const;

export interface ParcelStatusUpdatePayload {
  trackingCode: string;
  currentStatus: ParcelStatus;
  event: { status: ParcelStatus; timestamp: string; note?: string };
}

export interface ParcelLocationPayload {
  trackingCode: string;
  latitude: number;
  longitude: number;
  timestamp: string;
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

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
    console.log('Nhận được ping:', data);
    client.emit('pong', 'pong tu server'); // gửi thẳng lại cho đúng client vừa gửi
  }

  // Client (trang tracking) vào room theo mã vận đơn để nhận cập nhật của đúng đơn đó
  @SubscribeMessage('join:parcel')
  async handleJoinParcel(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ) {
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
    const trackingCode = readTrackingCode(body);
    if (!trackingCode) return { ok: false, error: 'trackingCode is required' };
    await client.leave(parcelRoom(trackingCode));
    return { ok: true, trackingCode };
  }

  // Driver app gửi GPS (mỗi 3–5s); server gắn timestamp rồi phát lại cho khách đang xem đơn.
  // TODO(M2): xác thực JWT shipper + kiểm tra đơn thuộc tài xế (nhánh fix/m2-backend).
  @SubscribeMessage('driver:location')
  handleDriverLocation(@MessageBody() body: unknown) {
    const trackingCode = readTrackingCode(body);
    const { latitude, longitude } = (body ?? {}) as {
      latitude?: unknown;
      longitude?: unknown;
    };
    if (
      !trackingCode ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return { ok: false, error: 'invalid location payload' };
    }
    const payload: ParcelLocationPayload = {
      trackingCode,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    };
    this.server
      .to(parcelRoom(trackingCode))
      .emit(TRACKING_EVENTS.LOCATION_UPDATED, payload);
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
