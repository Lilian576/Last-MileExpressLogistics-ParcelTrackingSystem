import { Test, TestingModule } from '@nestjs/testing';
import { ParcelsService } from './parcels.service';
import { PrismaService } from '../common/prisma.service';
import { StateMachineService } from '../state-machine/state-machine.service';
import { DriverAssignmentService } from './driver-assignment.service';
import { TrackingGateway } from '../tracking/tracking.gateway';

describe('ParcelsService - Pricing Engine', () => {
  let service: ParcelsService;

  const mockPrisma = {
    parcel: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    parcelStatusHistory: { create: jest.fn() },
    deliveryAssignment: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockGateway = { emitStatusUpdated: jest.fn() };

  const mockStateMachine = {
    assertTransition: jest.fn(),
  };

  const mockDriverAssignment = {
    assignNearestCourier: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParcelsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StateMachineService, useValue: mockStateMachine },
        { provide: DriverAssignmentService, useValue: mockDriverAssignment },
        { provide: TrackingGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<ParcelsService>(ParcelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

  describe('updateStatus', () => {
    const parcel = { id: 'p1', trackingCode: 'PCL1', currentStatus: 'PENDING_PICKUP' };

    it('lưu DB + ghi history rồi emit event cho đúng trackingCode', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockStateMachine.assertTransition.mockReturnValue('PICKED_UP');
      const createdAt = new Date('2026-10-27T01:00:00.000Z');
      mockPrisma.$transaction.mockResolvedValue([
        { ...parcel, currentStatus: 'PICKED_UP' },
        { createdAt },
      ]);

      const result = await service.updateStatus(
        'p1',
        { event: 'confirm_pickup' } as never,
        'shipper',
        'driver-1',
      );

      expect(result.currentStatus).toBe('PICKED_UP');
      expect(mockPrisma.parcelStatusHistory.create).toHaveBeenCalledWith({
        data: { parcelId: 'p1', status: 'PICKED_UP', changedBy: 'driver-1' },
      });
      expect(mockGateway.emitStatusUpdated).toHaveBeenCalledWith({
        trackingCode: 'PCL1',
        currentStatus: 'PICKED_UP',
        event: { status: 'PICKED_UP', timestamp: createdAt.toISOString() },
      });
    });

    it('transition không hợp lệ -> throw và KHÔNG emit', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockStateMachine.assertTransition.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(
        service.updateStatus('p1', { event: 'confirm_delivery' } as never, 'shipper'),
      ).rejects.toThrow('invalid');
      expect(mockGateway.emitStatusUpdated).not.toHaveBeenCalled();
    });

    it('không tìm thấy đơn -> NotFoundException', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('x', { event: 'confirm_pickup' } as never, 'shipper'),
      ).rejects.toThrow('Không tìm thấy');
    });
  });

  describe('findAssignedTo', () => {
    it('trả về đơn của shipper, khử trùng khi 1 đơn có 2 assignment', async () => {
      const p = { id: 'p1', trackingCode: 'PCL1' };
      mockPrisma.deliveryAssignment.findMany.mockResolvedValue([{ parcel: p }, { parcel: p }]);
      const list = await service.findAssignedTo('driver-1');
      expect(list).toEqual([p]);
      expect(mockPrisma.deliveryAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ courierId: 'driver-1' }) }),
      );
    });
  });
});
