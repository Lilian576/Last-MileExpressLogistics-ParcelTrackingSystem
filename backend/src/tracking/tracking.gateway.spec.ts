import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { TrackingGateway, TRACKING_EVENTS } from './tracking.gateway';

// Test WebSocket thật: server Nest + client socket.io, không cần DB.
describe('TrackingGateway (WebSocket)', () => {
  let app: INestApplication;
  let gateway: TrackingGateway;
  let url: string;
  const sockets: Socket[] = [];

  const connect = (): Promise<Socket> =>
    new Promise((resolve) => {
      const s = io(url, { transports: ['websocket'] });
      sockets.push(s);
      s.on('connect', () => resolve(s));
    });

  const join = (s: Socket, trackingCode: string) =>
    s.emitWithAck('join:parcel', { trackingCode }) as Promise<{ ok: boolean }>;

  const update = (trackingCode: string, status: 'PICKED_UP' | 'DELIVERED') => ({
    trackingCode,
    currentStatus: status,
    event: { status, timestamp: '2026-10-27T01:00:00.000Z' },
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TrackingGateway],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    const server = app.getHttpServer() as Server;
    url = `http://localhost:${(server.address() as AddressInfo).port}`;
    gateway = app.get(TrackingGateway);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  });

  it('client trong room nhận parcel.status.updated, client room khác thì không', async () => {
    const a = await connect();
    const b = await connect();
    expect(await join(a, 'PCL-A')).toEqual({ ok: true, trackingCode: 'PCL-A' });
    await join(b, 'PCL-B');

    const gotA = new Promise((r) => a.once(TRACKING_EVENTS.STATUS_UPDATED, r));
    const gotB = jest.fn();
    b.on(TRACKING_EVENTS.STATUS_UPDATED, gotB);

    gateway.emitStatusUpdated(update('PCL-A', 'PICKED_UP'));

    expect(await gotA).toEqual(update('PCL-A', 'PICKED_UP'));
    await new Promise((r) => setTimeout(r, 150));
    expect(gotB).not.toHaveBeenCalled();
  });

  it('DELIVERED phát thêm parcel.delivery.completed', async () => {
    const a = await connect();
    await join(a, 'PCL-D');
    const done = new Promise((r) =>
      a.once(TRACKING_EVENTS.DELIVERY_COMPLETED, r),
    );
    gateway.emitStatusUpdated(update('PCL-D', 'DELIVERED'));
    expect(await done).toEqual(update('PCL-D', 'DELIVERED'));
  });

  it('leave:parcel thì không nhận nữa', async () => {
    const a = await connect();
    await join(a, 'PCL-L');
    await a.emitWithAck('leave:parcel', { trackingCode: 'PCL-L' });
    const got = jest.fn();
    a.on(TRACKING_EVENTS.STATUS_UPDATED, got);
    gateway.emitStatusUpdated(update('PCL-L', 'PICKED_UP'));
    await new Promise((r) => setTimeout(r, 150));
    expect(got).not.toHaveBeenCalled();
  });

  it('join thiếu trackingCode -> ok:false', async () => {
    const a = await connect();
    expect(await a.emitWithAck('join:parcel', {})).toEqual({
      ok: false,
      error: 'trackingCode is required',
    });
  });

  it('mất mạng rồi reconnect: join lại room thì nhận event tiếp', async () => {
    const a = await connect();
    await join(a, 'PCL-R');
    a.disconnect();
    await new Promise<void>((r) => {
      a.once('connect', () => r());
      a.connect();
    });
    await join(a, 'PCL-R');
    const got = new Promise((r) => a.once(TRACKING_EVENTS.STATUS_UPDATED, r));
    gateway.emitStatusUpdated(update('PCL-R', 'PICKED_UP'));
    expect(await got).toEqual(update('PCL-R', 'PICKED_UP'));
  });
});
