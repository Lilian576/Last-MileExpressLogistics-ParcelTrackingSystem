import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';

describe('End-to-End Parcel Delivery & Tracking Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socket: Socket;
  let baseUrl: string;

  let customerToken: string;
  let trackingCode: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    await app.listen(0);

    const httpServer = app.getHttpServer() as Server;
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await app.close();
  });

  it('1. Register & login customer and shipper accounts', async () => {
    const uniqueSuffix = Date.now();
    const customerEmail = `cust_${uniqueSuffix}@test.com`;
    const shipperEmail = `ship_${uniqueSuffix}@test.com`;

    const server = app.getHttpServer() as Server;

    await request(server)
      .post('/auth/register')
      .send({
        email: customerEmail,
        password: 'Password123!',
        fullName: 'Test Customer',
      })
      .expect(201);

    const custLogin = await request(server)
      .post('/auth/login')
      .send({ email: customerEmail, password: 'Password123!' })
      .expect(200);

    const loginBody = custLogin.body as {
      accessToken: string;
      user?: { passwordHash?: string };
    };
    customerToken = loginBody.accessToken;

    await prisma.user.create({
      data: {
        email: shipperEmail,
        passwordHash: loginBody.user?.passwordHash || 'hashed',
        fullName: 'Test Shipper',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        role: 'shipper' as any,
        currentLatitude: 10.762622,
        currentLongitude: 106.660172,
      },
    });
  });

  it('2. Create parcel via POST /api/parcels', async () => {
    const server = app.getHttpServer() as Server;
    const res = await request(server)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        receiverName: 'Nguyen Van B',
        receiverPhone: '0901234567',
        receiverAddress: '19 Nguyen Huu Tho, Q7, HCMC',
        weightKg: 2.5,
        senderLat: 10.762622,
        senderLng: 106.660172,
        receiverLat: 10.732669,
        receiverLng: 106.699173,
      })
      .expect(201);

    const parcelBody = res.body as { trackingCode: string };
    trackingCode = parcelBody.trackingCode;
  });

  it('3. Join WebSocket room via join:parcel and verify tracking', async () => {
    socket = io(baseUrl, { transports: ['websocket'] });

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:parcel', { trackingCode });
        resolve();
      });
    });

    const server = app.getHttpServer() as Server;
    const trackRes = await request(server)
      .get(`/api/public/track/${trackingCode}`)
      .expect(200);

    const trackBody = trackRes.body as { trackingCode: string; status: string };
    expect(trackBody.trackingCode).toBe(trackingCode);
    expect(trackBody.status).toBe('CREATED');
  });
});
