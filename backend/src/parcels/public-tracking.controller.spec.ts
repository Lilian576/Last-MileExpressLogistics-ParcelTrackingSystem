import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PublicTrackingController } from './public-tracking.controller';
import { ParcelsService } from './parcels.service';

// Test HTTP thật (không cần DB): kiểm tra đúng đường dẫn, 200 và 404.
describe('PublicTrackingController (GET /api/public/track/:code)', () => {
  let app: INestApplication<App>;
  const mockService = { findPublicTracking: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicTrackingController],
      providers: [{ provide: ParcelsService, useValue: mockService }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('200 và trả đúng dữ liệu theo mã vận đơn, không cần đăng nhập', async () => {
    const body = {
      trackingCode: 'PCL1',
      currentStatus: 'PICKED_UP',
      receiverName: 'An',
      history: [{ status: 'CREATED', timestamp: '2026-10-27T01:00:00.000Z' }],
    };
    mockService.findPublicTracking.mockResolvedValue(body);

    const res = await request(app.getHttpServer())
      .get('/api/public/track/PCL1')
      .expect(200);

    expect(res.body).toEqual(body);
    expect(mockService.findPublicTracking).toHaveBeenCalledWith('PCL1');
  });

  it('404 khi không có đơn (Frontend dựa vào 404 để hiện "không tìm thấy")', async () => {
    mockService.findPublicTracking.mockRejectedValue(
      new NotFoundException('Không tìm thấy đơn hàng'),
    );
    await request(app.getHttpServer())
      .get('/api/public/track/NOPE')
      .expect(404);
  });
});
