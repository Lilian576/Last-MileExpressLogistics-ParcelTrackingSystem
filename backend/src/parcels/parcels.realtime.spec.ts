import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParcelsModule } from './parcels.module';
import { TRACKING_EVENTS } from '../tracking/tracking.gateway';

interface FakeParcel {
  id: string;
  trackingCode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  currentStatus: string;
  failedAttemptCount: number;
  createdAt: Date;
  updatedAt: Date;
}
interface FakeHistory {
  parcelId: string;
  status: string;
  changedBy: string | null;
  note: string | null;
  createdAt: Date;
}

// Prisma giả trong bộ nhớ, đủ cho luồng: tra cứu công khai + đổi trạng thái
function createFakePrisma(parcel: FakeParcel) {
  const history: FakeHistory[] = [];
  const prisma = {
    history,
    parcel: {
      findUnique: ({
        where,
      }: {
        where: { id?: string; trackingCode?: string };
      }) => {
        const hit =
          where.id === parcel.id || where.trackingCode === parcel.trackingCode;
        return Promise.resolve(
          hit ? { ...parcel, statusHistory: [...history] } : null,
        );
      },
      // Khóa lạc quan: chỉ cập nhật nếu trạng thái cũ còn khớp
      updateMany: ({
        where,
        data,
      }: {
        where: { currentStatus: string };
        data: { currentStatus: string };
      }) => {
        if (parcel.currentStatus !== where.currentStatus) {
          return Promise.resolve({ count: 0 });
        }
        parcel.currentStatus = data.currentStatus;
        return Promise.resolve({ count: 1 });
      },
      findUniqueOrThrow: () => Promise.resolve({ ...parcel }),
    },
    // Shipper driver-1 đang được giao đơn p1
    deliveryAssignment: { count: () => Promise.resolve(1) },
    parcelStatusHistory: {
      create: ({
        data,
      }: {
        data: { parcelId: string; status: string; changedBy: string | null };
      }) => {
        const row: FakeHistory = {
          ...data,
          note: null,
          createdAt: new Date(),
        };
        history.push(row);
        return Promise.resolve(row);
      },
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(fakePrisma),
  };
  const fakePrisma = prisma;
  return prisma;
}

// Giả lập JwtAuthGuard: coi như đã đăng nhập với role shipper
class FakeShipperGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ user: { userId: string; role: string } }>();
    req.user = { userId: 'driver-1', role: 'shipper' };
    return true;
  }
}

// End-to-end toàn chuỗi (không cần DB): HTTP snapshot -> WebSocket room ->
// tài xế PATCH status -> trang tracking nhận event realtime.
describe('Realtime tracking end-to-end', () => {
  let app: INestApplication;
  let url: string;
  let socket: Socket;
  let fake: ReturnType<typeof createFakePrisma>;
  const parcel: FakeParcel = {
    id: 'p1',
    trackingCode: 'PCL1',
    receiverName: 'An',
    receiverPhone: '0900000000',
    receiverAddress: '1 Lê Lợi',
    currentStatus: 'PENDING_PICKUP',
    failedAttemptCount: 0,
    createdAt: new Date('2026-10-27T01:00:00.000Z'),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    fake = createFakePrisma(parcel);
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          // AuthModule yêu cầu JWT_SECRET riêng, không chấp nhận giá trị mặc định
          load: [() => ({ JWT_SECRET: 'test-only-signing-key' })],
        }),
        ParcelsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(fake)
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeShipperGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0);
    const server = app.getHttpServer() as Server;
    url = `http://localhost:${(server.address() as AddressInfo).port}`;

    socket = io(url, { transports: ['websocket'] });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    await socket.emitWithAck('join:parcel', { trackingCode: 'PCL1' });
  });

  afterAll(async () => {
    socket.disconnect();
    await app.close();
  });

  it('GET /api/public/track/:code trả snapshot, không lộ SĐT/địa chỉ', async () => {
    const res = await request(url).get('/api/public/track/PCL1').expect(200);
    const body = res.body as {
      currentStatus: string;
      history: { status: string }[];
    };
    expect(body.currentStatus).toBe('PENDING_PICKUP');
    expect(body.history[0].status).toBe('CREATED');
    expect(JSON.stringify(body)).not.toContain('0900000000');
    expect(JSON.stringify(body)).not.toContain('Lê Lợi');
  });

  it('mã không tồn tại -> 404', async () => {
    await request(url).get('/api/public/track/NOPE').expect(404);
  });

  it('tài xế PATCH status -> trang tracking nhận event, khớp với snapshot REST', async () => {
    const received = new Promise<{
      currentStatus: string;
      event: { status: string; timestamp: string };
    }>((resolve) => socket.once(TRACKING_EVENTS.STATUS_UPDATED, resolve));

    await request(url)
      .patch('/api/parcels/p1/status')
      .send({ event: 'confirm_pickup' })
      .expect(200);

    const update = await received;
    expect(update.currentStatus).toBe('PICKED_UP');

    // Resync qua REST phải ra cùng mốc thời gian với event -> client khử trùng được
    const res = await request(url).get('/api/public/track/PCL1').expect(200);
    const snap = res.body as {
      currentStatus: string;
      history: { status: string; timestamp: string }[];
    };
    expect(snap.currentStatus).toBe('PICKED_UP');
    expect(snap.history[snap.history.length - 1]).toEqual(update.event);
    expect(fake.history).toHaveLength(1);
    expect(fake.history[0].changedBy).toBe('driver-1');
  });

  it('transition sai -> 400, DB không đổi và KHÔNG phát event', async () => {
    const got = jest.fn();
    socket.on(TRACKING_EVENTS.STATUS_UPDATED, got);

    await request(url)
      .patch('/api/parcels/p1/status')
      .send({ event: 'confirm_delivery', hasDeliveryProof: true })
      .expect(400);

    await new Promise((r) => setTimeout(r, 150));
    expect(got).not.toHaveBeenCalled();
    expect(parcel.currentStatus).toBe('PICKED_UP');
    socket.off(TRACKING_EVENTS.STATUS_UPDATED, got);
  });
});
