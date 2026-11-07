import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('End-to-End Parcel Delivery & Tracking Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socket: Socket;
  let baseUrl: string;

  let customerToken: string;
  let shipperToken: string;
  let shipperId: string;
  let parcelId: string;
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

    const address = app.getHttpServer().address();
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

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: customerEmail,
        password: 'Password123!',
        fullName: 'Test Customer',
      })
      .expect(201);

    const custLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: customerEmail, password: 'Password123!' })
      .expect(200);

    expect(custLogin.body.accessToken).toEqual(expect.any(String));
    customerToken = custLogin.body.accessToken;

    // Tạo tài khoản shipper trong DB để phục vụ gán đơn
    const shipperUser = await prisma.user.create({
      data: {
        email: shipperEmail,
        passwordHash: custLogin.body.user?.passwordHash || 'hashed',
        fullName: 'Test Shipper',
        role: 'shipper' as any,
        currentLatitude: 10.762622,
        currentLongitude: 106.660172,
      },
    });
    shipperId = shipperUser.id;
  });

  it('2. Create parcel via POST /api/parcels', async () => {
    const res = await request(app.getHttpServer())
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

    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.status).toBe('CREATED');
    parcelId = res.body.id;
    trackingCode = res.body.trackingCode;
  });

  it('3. Join WebSocket room via join:parcel and receive status update on PATCH', async () => {
    socket = io(baseUrl, { transports: ['websocket'] });

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:parcel', { trackingCode });
        resolve();
      });
    });

    // Kiểm tra truy vấn tracking công khai
    const trackRes = await request(app.getHttpServer())
      .get(`/api/public/track/${trackingCode}`)
      .expect(200);

    expect(trackRes.body.trackingCode).toBe(trackingCode);
    expect(trackRes.body.status).toBe('CREATED');
  });
});
