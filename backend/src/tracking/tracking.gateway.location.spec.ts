import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { PrismaService } from '../common/prisma.service';
import { TrackingGateway, TRACKING_EVENTS } from './tracking.gateway';

// Test event driver:location: JWT shipper + đúng đơn được giao, phát cho room tracking.
describe('TrackingGateway - driver:location', () => {
  let app: INestApplication;
  let url: string;
  const sockets: Socket[] = [];
  const assignmentCount = jest.fn();

  // Token giả: "<role>:<userId>"; verifyAsync ném lỗi nếu không đúng định dạng
  const fakeJwt = {
    verifyAsync: (token: string) => {
      const [role, sub] = token.split(':');
      if (!role || !sub) return Promise.reject(new Error('bad token'));
      return Promise.resolve({ role, sub });
    },
  };

  const connect = (token?: string): Promise<Socket> =>
    new Promise((resolve) => {
      const s = io(url, { transports: ['websocket'], auth: { token } });
      sockets.push(s);
      s.on('connect', () => resolve(s));
    });

  const send = (s: Socket, body: unknown) =>
    s.emitWithAck('driver:location', body) as Promise<{
      ok: boolean;
      error?: string;
    }>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackingGateway,
        { provide: JwtService, useValue: fakeJwt },
        {
          provide: PrismaService,
          useValue: { deliveryAssignment: { count: assignmentCount } },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    url = `http://localhost:${((app.getHttpServer() as Server).address() as AddressInfo).port}`;
  });

  beforeEach(() => assignmentCount.mockReset());

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  });

  it('shipper được giao đơn gửi GPS -> khách trong room nhận parcel.location.updated', async () => {
    assignmentCount.mockResolvedValue(1);
    const customer = await connect();
    await customer.emitWithAck('join:parcel', { trackingCode: 'PCL-G' });
    const got = new Promise<{ lat: number; lng: number }>((r) =>
      customer.once(TRACKING_EVENTS.LOCATION_UPDATED, r),
    );

    const driver = await connect('shipper:driver-1');
    expect(
      await send(driver, { trackingCode: 'PCL-G', lat: 10.78, lng: 106.7 }),
    ).toEqual({ ok: true });

    const payload = await got;
    expect(payload).toMatchObject({
      trackingCode: 'PCL-G',
      lat: 10.78,
      lng: 106.7,
    });
  });

  it('không có token -> unauthorized, không phát', async () => {
    const c = await connect();
    expect(await send(c, { trackingCode: 'PCL-G', lat: 1, lng: 1 })).toEqual({
      ok: false,
      error: 'unauthorized',
    });
  });

  it('token không phải shipper -> unauthorized', async () => {
    const c = await connect('customer:u1');
    expect(await send(c, { trackingCode: 'PCL-G', lat: 1, lng: 1 })).toEqual({
      ok: false,
      error: 'unauthorized',
    });
  });

  it('shipper không được giao đơn đó -> forbidden', async () => {
    assignmentCount.mockResolvedValue(0);
    const c = await connect('shipper:driver-2');
    expect(await send(c, { trackingCode: 'PCL-X', lat: 1, lng: 1 })).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it('toạ độ ngoài phạm vi / thiếu trackingCode -> invalid payload', async () => {
    const c = await connect('shipper:driver-1');
    const bad = { ok: false, error: 'invalid payload' };
    expect(await send(c, { trackingCode: 'PCL-G', lat: 200, lng: 1 })).toEqual(
      bad,
    );
    expect(await send(c, { trackingCode: 'PCL-G', lat: '1', lng: 1 })).toEqual(
      bad,
    );
    expect(await send(c, { lat: 1, lng: 1 })).toEqual(bad);
  });

  it('gửi quá nhiều message trong cửa sổ -> rate_limited', async () => {
    const c = await connect();
    let last: { ok: boolean; error?: string } = { ok: true };
    for (let i = 0; i < 35; i++) {
      last = (await c.emitWithAck('join:parcel', {
        trackingCode: 'PCL-RL',
      })) as typeof last;
    }
    expect(last).toEqual({ ok: false, error: 'rate_limited' });
  });
});
