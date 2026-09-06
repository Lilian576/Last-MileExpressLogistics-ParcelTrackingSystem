import { Test, TestingModule } from '@nestjs/testing';
import { ParcelsService } from './parcels.service';
import { PrismaService } from '../common/prisma.service';
import { StateMachineService } from '../state-machine/state-machine.service';

describe('ParcelsService', () => {
  let service: ParcelsService;

  // Prisma giả — chỉ giả lập đúng 2 hàm mà ParcelsService dùng tới
  const mockPrisma = {
    parcel: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockStateMachine = {
    assertTransition: jest.fn(),
  };

  beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
        ParcelsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StateMachineService, useValue: mockStateMachine },
      ],
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

  it('should create a new parcel and attach fee', async () => {
    mockPrisma.parcel.create.mockResolvedValue({
      id: 'fake-uuid',
      trackingCode: 'PCL123',
      currentStatus: 'CREATED',
      receiverName: 'Trần Thị B',
    });

    const parcel = await service.create(
      {
        receiverName: 'Trần Thị B',
        receiverPhone: '0900000000',
        receiverAddress: '123 Đường ABC',
        weightKg: 2,
        senderLat: 10.7769,
        senderLng: 106.7009,
        receiverLat: 10.8231,
        receiverLng: 106.6297,
      },
      'fake-sender-id',
    );

    expect(parcel.fee).toBeGreaterThan(0);
    expect(mockPrisma.parcel.create).toHaveBeenCalled();
  });

  it('should call findMany when findAll is called', async () => {
    mockPrisma.parcel.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(mockPrisma.parcel.findMany).toHaveBeenCalled();
  });
});