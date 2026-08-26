import { Test, TestingModule } from '@nestjs/testing';
import { ParcelsService } from './parcels.service';

describe('ParcelsService', () => {
  let service: ParcelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParcelsService],
    }).compile();

    service = module.get<ParcelsService>(ParcelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
