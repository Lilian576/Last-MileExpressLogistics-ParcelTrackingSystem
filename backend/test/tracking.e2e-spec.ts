import { INestApplication, ValidationPipe } from '@nestjs/common';
import { LocationType, Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { TransitionEvent } from '../src/state-machine/state-machine.types';
import {
  ParcelStatusUpdatePayload,
  TRACKING_EVENTS,
} from '../src/tracking/tracking.gateway';

type AuthResponse = {
  accessToken: string;
};

type ParcelResponse = {
  id: string;
  trackingCode: string;
  currentStatus: string;
};

type TrackingResponse = {
  trackingCode: string;
  currentStatus: string;
};

const parseJson = <T>(response: { text: string }): T =>
  JSON.parse(response.text) as T;

describe('Parcel delivery and tracking workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socket: Socket;
  let customerToken: string;
  let adminToken: string;
  let warehouseToken: string;
  let shipperToken: string;
  let lastMileShipperToken: string;
  let parcelId: string;
  let trackingCode: string;
  let hubId: string;

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
    prisma = app.get(PrismaService);

    const server = app.getHttpServer() as Server;
    const address = server.address() as AddressInfo;
    socket = io(`http://127.0.0.1:${address.port}`, {
      transports: ['websocket'],
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
  });

  afterAll(async () => {
    socket?.disconnect();
    await app?.close();
  });

  it('creates test customer, staff, shippers and destination hub', async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const server = app.getHttpServer() as Server;
    const register = await request(server)
      .post('/auth/register')
      .send({
        email: `customer_${suffix}@example.test`,
        password: 'Password123!',
        fullName: 'E2E Customer',
        phone: `09${suffix.slice(-8)}`,
      })
      .expect(201);
    customerToken = parseJson<AuthResponse>(register).accessToken;

    const passwordHash = await bcrypt.hash('Password123!', 10);
    await prisma.user.createMany({
      data: [
        {
          email: `admin_${suffix}@example.test`,
          fullName: 'E2E Admin',
          phone: `07${suffix.slice(-8)}`,
          passwordHash,
          role: Role.admin,
        },
        {
          email: `shipper_${suffix}@example.test`,
          fullName: 'E2E Shipper',
          phone: `08${suffix.slice(-8)}`,
          passwordHash,
          role: Role.shipper,
          currentLatitude: 10.762622,
          currentLongitude: 106.660172,
          locationUpdatedAt: new Date(),
        },
        {
          email: `last_mile_shipper_${suffix}@example.test`,
          fullName: 'E2E Last-Mile Shipper',
          phone: `06${suffix.slice(-8)}`,
          passwordHash,
          role: Role.shipper,
          currentLatitude: 10.732669,
          currentLongitude: 106.699173,
          locationUpdatedAt: new Date(),
        },
        {
          email: `warehouse_${suffix}@example.test`,
          fullName: 'E2E Warehouse Staff',
          phone: `05${suffix.slice(-8)}`,
          passwordHash,
          role: Role.warehouse_staff,
        },
      ],
    });

    const hub = await prisma.location.create({
      data: {
        name: `E2E Hub ${suffix}`,
        type: LocationType.hub,
        address: 'E2E test location',
        latitude: 10.732669,
        longitude: 106.699173,
      },
    });
    hubId = hub.id;

    const adminLogin = await request(server)
      .post('/auth/login')
      .send({ email: `admin_${suffix}@example.test`, password: 'Password123!' })
      .expect(200);
    adminToken = parseJson<AuthResponse>(adminLogin).accessToken;

    const warehouseLogin = await request(server)
      .post('/auth/login')
      .send({
        email: `warehouse_${suffix}@example.test`,
        password: 'Password123!',
      })
      .expect(200);
    warehouseToken = parseJson<AuthResponse>(warehouseLogin).accessToken;

    const shipperLogin = await request(server)
      .post('/auth/login')
      .send({
        email: `shipper_${suffix}@example.test`,
        password: 'Password123!',
      })
      .expect(200);
    shipperToken = parseJson<AuthResponse>(shipperLogin).accessToken;

    const lastMileShipperLogin = await request(server)
      .post('/auth/login')
      .send({
        email: `last_mile_shipper_${suffix}@example.test`,
        password: 'Password123!',
      })
      .expect(200);
    lastMileShipperToken =
      parseJson<AuthResponse>(lastMileShipperLogin).accessToken;
  });

  it('creates and subscribes to a parcel', async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        receiverName: 'E2E Receiver',
        receiverPhone: '0901234567',
        receiverAddress: 'E2E delivery address',
        weightKg: 2,
        senderLat: 10.762622,
        senderLng: 106.660172,
        receiverLat: 10.732669,
        receiverLng: 106.699173,
      })
      .expect(201);

    const parcel = parseJson<ParcelResponse>(response);
    parcelId = parcel.id;
    trackingCode = parcel.trackingCode;
    expect(parcel.currentStatus).toBe('CREATED');

    const joined = (await socket.emitWithAck('join:parcel', {
      trackingCode,
    })) as { ok: boolean; trackingCode: string };
    expect(joined).toEqual({ ok: true, trackingCode });
  });

  it('runs the delivery lifecycle and broadcasts every status transition', async () => {
    const server = app.getHttpServer() as Server;
    const expectBroadcast = async (
      status: string,
      action: () => Promise<unknown>,
    ) => {
      const event = new Promise<ParcelStatusUpdatePayload>((resolve) => {
        socket.once(TRACKING_EVENTS.STATUS_UPDATED, resolve);
      });
      await action();
      expect(await event).toMatchObject({
        trackingCode,
        currentStatus: status,
        event: { status },
      });
      const track = await request(server)
        .get(`/api/public/track/${trackingCode}`)
        .expect(200);
      expect(parseJson<TrackingResponse>(track).currentStatus).toBe(status);
    };

    await expectBroadcast('PENDING_PICKUP', () =>
      request(server)
        .patch(`/api/parcels/${parcelId}/assign-courier`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ destinationHubId: hubId })
        .then((response) => {
          expect(response.status).toBe(200);
          return response;
        }),
    );

    const updateStatus = (event: TransitionEvent, extra: object = {}) =>
      request(server)
        .patch(`/api/parcels/${parcelId}/status`)
        .set(
          'Authorization',
          `Bearer ${
            event === TransitionEvent.DISPATCH_LAST_MILE
              ? adminToken
              : event === TransitionEvent.ARRIVE_AT_HUB
                ? warehouseToken
                : event === TransitionEvent.CONFIRM_DELIVERY
                  ? lastMileShipperToken
                  : shipperToken
          }`,
        )
        .send({ event, ...extra })
        .then((response) => {
          expect(response.status).toBe(200);
          return response;
        });

    await expectBroadcast('PICKED_UP', () =>
      updateStatus(TransitionEvent.CONFIRM_PICKUP),
    );
    await expectBroadcast('IN_TRANSIT', () =>
      updateStatus(TransitionEvent.DEPART_TO_HUB),
    );
    await expectBroadcast('AT_HUB', () =>
      updateStatus(TransitionEvent.ARRIVE_AT_HUB, { hubId }),
    );
    await expectBroadcast('OUT_FOR_DELIVERY', () =>
      updateStatus(TransitionEvent.DISPATCH_LAST_MILE),
    );
    await expectBroadcast('DELIVERED', () =>
      updateStatus(TransitionEvent.CONFIRM_DELIVERY, {
        deliveryProofRef: 'e2e-proof-reference',
      }),
    );
  });

  it('rejects unknown tracking codes', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/public/track/LM_NOT_FOUND')
      .expect(404);
  });
});
