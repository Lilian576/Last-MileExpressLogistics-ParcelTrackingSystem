import { Test, TestingModule } from '@nestjs/testing';
import { ParcelsService } from './parcels.service';

describe('ParcelsService - Pricing Engine', () => {
  let service: ParcelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParcelsService],
    }).compile();

    service = module.get<ParcelsService>(ParcelsService);
  });

  describe('calculateFee', () => {
    it('1. Tính đúng phí cơ bản khi khoảng cách = 0km', () => {
      const fee = service.calculateFee({
        weightKg: 1,
        senderLat: 10.776,
        senderLng: 106.701,
        receiverLat: 10.776, 
        receiverLng: 106.701,
      });
      expect(fee).toBe(20000);
    });

    it('2. Tính chính xác theo công thức Haversine', () => {
      const fee = service.calculateFee({
        weightKg: 2,
        senderLat: 0,
        senderLng: 0,
        receiverLat: 0,
        receiverLng: 1,
      });
      expect(fee).toBeGreaterThanOrEqual(136194);
      expect(fee).toBeLessThanOrEqual(136196);
    });

    it('3. Đơn hàng trọng lượng 0kg', () => {
      const fee = service.calculateFee({
        weightKg: 0,
        senderLat: 10.0,
        senderLng: 106.0,
        receiverLat: 10.0,
        receiverLng: 106.0,
      });
      expect(fee).toBe(15000); 
    });
  });
});