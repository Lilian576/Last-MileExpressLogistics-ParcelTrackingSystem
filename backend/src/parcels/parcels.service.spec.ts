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
    it('should calculate fee correctly', () => {
    const fee = service.calculateFee({
      weightKg: 2,
      senderLat: 10.7769,
      senderLng: 106.7009,
      receiverLat: 10.8231,
      receiverLng: 106.6297,
    });

    expect(fee).toBeGreaterThan(0);
    expect(typeof fee).toBe('number');
  });

  it('should create a new parcel with status CREATED', () => {
    const parcel = service.create({
      senderName: 'Nguyễn Văn A',
      senderLat: 10.7769,
      senderLng: 106.7009,
      receiverName: 'Trần Thị B',
      receiverLat: 10.8231,
      receiverLng: 106.6297,
      weightKg: 2,
    });

    expect(parcel.status).toBe('CREATED');
    expect(parcel.fee).toBeGreaterThan(0);
    expect(parcel.trackingCode).toBeDefined();
  });

  it('should return the created parcel in findAll', () => {
    service.create({
      senderName: 'Nguyễn Văn A',
      senderLat: 10.7769,
      senderLng: 106.7009,
      receiverName: 'Trần Thị B',
      receiverLat: 10.8231,
      receiverLng: 106.6297,
      weightKg: 2,
    });

    const all = service.findAll();
    expect(all.length).toBeGreaterThan(0);
  });
});
