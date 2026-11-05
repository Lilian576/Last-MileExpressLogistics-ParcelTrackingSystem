import { ConflictException, NotFoundException } from '@nestjs/common';
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
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    parcelStatusHistory: { create: jest.fn() },
    deliveryAssignment: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockGateway = { emitStatusUpdated: jest.fn() };

  const mockStateMachine = {
    assertTransition: jest.fn(),
  };

  const mockDriverAssignment = {
    findNearestAvailableCourier: jest.fn(),
    createPickupAssignment: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    // Transaction tương tác: chạy callback với chính mock Prisma
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(mockPrisma),
    );
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
    const parcel = {
      id: 'p1',
      trackingCode: 'PCL1',
      currentStatus: 'PENDING_PICKUP',
      failedAttemptCount: 0,
      updatedAt: new Date(),
    };
    const createdAt = new Date('2026-10-27T01:00:00.000Z');

    const setupCommit = () => {
      mockPrisma.parcel.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.parcelStatusHistory.create.mockResolvedValue({ createdAt });
      mockPrisma.parcel.findUniqueOrThrow.mockResolvedValue({
        ...parcel,
        currentStatus: 'PICKED_UP',
      });
    };

    it('lưu DB + ghi history rồi emit event cho đúng trackingCode', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockPrisma.deliveryAssignment.count.mockResolvedValue(1);
      mockStateMachine.assertTransition.mockReturnValue('PICKED_UP');
      setupCommit();

      const result = await service.updateStatus(
        'p1',
        { event: 'confirm_pickup' } as never,
        'shipper',
        'driver-1',
      );

      expect(result.currentStatus).toBe('PICKED_UP');
      expect(mockPrisma.parcel.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', currentStatus: 'PENDING_PICKUP' },
        data: { currentStatus: 'PICKED_UP' },
      });
      expect(mockPrisma.parcelStatusHistory.create).toHaveBeenCalledWith({
        data: { parcelId: 'p1', status: 'PICKED_UP', changedBy: 'driver-1' },
      });
      expect(mockGateway.emitStatusUpdated).toHaveBeenCalledWith({
        trackingCode: 'PCL1',
        currentStatus: 'PICKED_UP',
        event: { status: 'PICKED_UP', timestamp: createdAt.toISOString() },
      });
    });

    it('context guard lấy từ DB: shipper được giao -> isAssignedCourier=true', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockPrisma.deliveryAssignment.count.mockResolvedValue(1);
      mockStateMachine.assertTransition.mockReturnValue('PICKED_UP');
      setupCommit();

      await service.updateStatus(
        'p1',
        { event: 'confirm_pickup' } as never,
        'shipper',
        'driver-1',
      );

      const ctx = (
        mockStateMachine.assertTransition.mock.calls[0] as unknown[]
      )[3] as {
        isAssignedCourier: boolean;
        failedAttemptCount: number;
      };
      expect(ctx.isAssignedCourier).toBe(true);
      expect(ctx.failedAttemptCount).toBe(0);
    });

    it('KHÔNG tin cờ client: shipper không được giao -> isAssignedCourier=false', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockPrisma.deliveryAssignment.count.mockResolvedValue(0);
      mockStateMachine.assertTransition.mockImplementation(() => {
        throw new Error('guard failed');
      });

      await expect(
        service.updateStatus(
          'p1',
          { event: 'confirm_pickup', isAssignedCourier: true } as never,
          'shipper',
          'driver-2',
        ),
      ).rejects.toThrow('guard failed');

      const ctx = (
        mockStateMachine.assertTransition.mock.calls[0] as unknown[]
      )[3] as {
        isAssignedCourier: boolean;
      };
      expect(ctx.isAssignedCourier).toBe(false);
      expect(mockGateway.emitStatusUpdated).not.toHaveBeenCalled();
    });

    it('shipper không được tự khai isHubLocation / isFinalHub', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockPrisma.deliveryAssignment.count.mockResolvedValue(1);
      mockStateMachine.assertTransition.mockImplementation(() => {
        throw new Error('x');
      });

      await expect(
        service.updateStatus(
          'p1',
          {
            event: 'arrive_at_hub',
            isHubLocation: true,
            isFinalHub: true,
          } as never,
          'shipper',
          'driver-1',
        ),
      ).rejects.toThrow('x');

      const ctx = (
        mockStateMachine.assertTransition.mock.calls[0] as unknown[]
      )[3] as {
        isHubLocation: boolean;
        isFinalHub?: boolean;
      };
      expect(ctx.isHubLocation).toBe(false);
      expect(ctx.isFinalHub).toBeUndefined();
    });

    it('transition không hợp lệ -> throw và KHÔNG ghi DB / emit', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockPrisma.deliveryAssignment.count.mockResolvedValue(1);
      mockStateMachine.assertTransition.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(
        service.updateStatus(
          'p1',
          { event: 'confirm_delivery' } as never,
          'shipper',
        ),
      ).rejects.toThrow('invalid');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockGateway.emitStatusUpdated).not.toHaveBeenCalled();
    });

    it('trạng thái đổi giữa chừng (race) -> 409, không ghi history, không emit', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockPrisma.deliveryAssignment.count.mockResolvedValue(1);
      mockStateMachine.assertTransition.mockReturnValue('PICKED_UP');
      mockPrisma.parcel.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(
          'p1',
          { event: 'confirm_pickup' } as never,
          'shipper',
          'driver-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.parcelStatusHistory.create).not.toHaveBeenCalled();
      expect(mockGateway.emitStatusUpdated).not.toHaveBeenCalled();
    });

    it('report_failed_delivery tăng failedAttemptCount', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue({
        ...parcel,
        currentStatus: 'OUT_FOR_DELIVERY',
      });
      mockPrisma.deliveryAssignment.count.mockResolvedValue(1);
      mockStateMachine.assertTransition.mockReturnValue('DELIVERY_FAILED');
      setupCommit();

      await service.updateStatus(
        'p1',
        { event: 'report_failed_delivery' } as never,
        'shipper',
        'driver-1',
      );

      expect(mockPrisma.parcel.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', currentStatus: 'OUT_FOR_DELIVERY' },
        data: {
          currentStatus: 'DELIVERY_FAILED',
          failedAttemptCount: { increment: 1 },
        },
      });
    });

    it('lỗi emit sau commit không làm request thất bại', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockPrisma.deliveryAssignment.count.mockResolvedValue(1);
      mockStateMachine.assertTransition.mockReturnValue('PICKED_UP');
      setupCommit();
      mockGateway.emitStatusUpdated.mockImplementation(() => {
        throw new Error('socket down');
      });

      await expect(
        service.updateStatus(
          'p1',
          { event: 'confirm_pickup' } as never,
          'shipper',
          'driver-1',
        ),
      ).resolves.toBeDefined();
    });

    it('không tìm thấy đơn -> NotFoundException', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus(
          'x',
          { event: 'confirm_pickup' } as never,
          'shipper',
        ),
      ).rejects.toThrow('Không tìm thấy');
    });
  });

  describe('assignCourier', () => {
    const parcel = {
      id: 'p1',
      trackingCode: 'PCL1',
      currentStatus: 'CREATED',
    };
    const dto = { pickupLat: 10.77, pickupLng: 106.7 };
    const courier = { id: 'c1', fullName: 'Shipper A' };

    it('tạo assignment + đổi trạng thái + ghi history trong 1 transaction rồi emit', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockDriverAssignment.findNearestAvailableCourier.mockResolvedValue({
        found: true,
        courier,
        distanceKm: 1.5,
      });
      mockStateMachine.assertTransition.mockReturnValue('PENDING_PICKUP');
      mockPrisma.parcel.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.parcelStatusHistory.create.mockResolvedValue({
        createdAt: new Date('2026-10-27T01:00:00.000Z'),
      });
      mockDriverAssignment.createPickupAssignment.mockResolvedValue({
        id: 'a1',
      });
      mockPrisma.parcel.findUniqueOrThrow.mockResolvedValue({
        ...parcel,
        currentStatus: 'PENDING_PICKUP',
      });

      const res = await service.assignCourier(
        'p1',
        dto,
        'dispatcher',
        'admin-1',
      );

      expect(mockDriverAssignment.createPickupAssignment).toHaveBeenCalledWith(
        mockPrisma,
        'p1',
        'c1',
      );
      expect(res.parcel.currentStatus).toBe('PENDING_PICKUP');
      expect(res.assignmentResult.courier).toEqual(courier);
      expect(mockGateway.emitStatusUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingCode: 'PCL1',
          currentStatus: 'PENDING_PICKUP',
        }),
      );
    });

    it('transition bị từ chối -> KHÔNG tạo assignment, không đổi DB, không emit', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue({
        ...parcel,
        currentStatus: 'DELIVERED',
      });
      mockDriverAssignment.findNearestAvailableCourier.mockResolvedValue({
        found: true,
        courier,
        distanceKm: 1,
      });
      mockStateMachine.assertTransition.mockImplementation(() => {
        throw new Error('invalid transition');
      });

      await expect(
        service.assignCourier('p1', dto, 'dispatcher'),
      ).rejects.toThrow('invalid transition');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(
        mockDriverAssignment.createPickupAssignment,
      ).not.toHaveBeenCalled();
      expect(mockGateway.emitStatusUpdated).not.toHaveBeenCalled();
    });

    it('không có shipper rảnh -> 409, không ghi DB', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      mockDriverAssignment.findNearestAvailableCourier.mockResolvedValue({
        found: false,
        reason: 'Không có shipper nào đang rảnh',
      });
      mockStateMachine.assertTransition.mockReturnValue('PENDING_PICKUP');

      await expect(
        service.assignCourier('p1', dto, 'dispatcher'),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('đơn không tồn tại -> 404 (không crash vì parcel!)', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(null);
      await expect(
        service.assignCourier('nope', dto, 'dispatcher'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneForUser', () => {
    const parcel = {
      id: 'p1',
      senderId: 'u1',
      assignments: [{ courierId: 'c1' }],
    };

    it.each([
      ['người gửi', { userId: 'u1', role: 'customer' }],
      ['shipper được giao', { userId: 'c1', role: 'shipper' }],
      ['admin', { userId: 'a1', role: 'admin' }],
      ['nhân viên kho', { userId: 'w1', role: 'warehouse_staff' }],
    ])('%s xem được', async (_name, user) => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      const res = await service.findOneForUser('p1', user);
      expect(res.id).toBe('p1');
      expect(res).not.toHaveProperty('assignments');
    });

    it('người lạ -> 404 (không lộ đơn tồn tại)', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(parcel);
      await expect(
        service.findOneForUser('p1', { userId: 'u2', role: 'customer' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAssignedTo', () => {
    it('trả về đơn của shipper, khử trùng khi 1 đơn có 2 assignment', async () => {
      const p = { id: 'p1', trackingCode: 'PCL1' };
      mockPrisma.deliveryAssignment.findMany.mockResolvedValue([
        { parcel: p },
        { parcel: p },
      ]);
      const list = await service.findAssignedTo('driver-1');
      expect(list).toEqual([p]);
      const [args] = mockPrisma.deliveryAssignment.findMany.mock.calls[0] as [
        { where: { courierId: string } },
      ];
      expect(args.where.courierId).toBe('driver-1');
    });
  });
  describe('findPublicTracking', () => {
    const createdAt = new Date('2026-10-27T01:00:00.000Z');
    const base = {
      id: 'p1',
      trackingCode: 'PCL1',
      currentStatus: 'PICKED_UP',
      receiverName: 'An',
      receiverPhone: '0900000000',
      receiverAddress: '1 Lê Lợi',
      senderId: 'u1',
      createdAt,
    };

    it('trả lịch sử theo thứ tự, bổ sung mốc CREATED khi DB chưa có', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue({
        ...base,
        statusHistory: [
          {
            status: 'PICKED_UP',
            createdAt: new Date('2026-10-27T02:00:00.000Z'),
            note: null,
          },
        ],
      });

      const result = await service.findPublicTracking('PCL1');

      expect(result.history).toEqual([
        { status: 'CREATED', timestamp: createdAt.toISOString() },
        { status: 'PICKED_UP', timestamp: '2026-10-27T02:00:00.000Z' },
      ]);
      expect(result.currentStatus).toBe('PICKED_UP');
    });

    it('không thêm CREATED lần 2 nếu lịch sử đã bắt đầu bằng CREATED', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue({
        ...base,
        currentStatus: 'CREATED',
        statusHistory: [{ status: 'CREATED', createdAt, note: 'tạo đơn' }],
      });

      const result = await service.findPublicTracking('PCL1');

      expect(result.history).toEqual([
        {
          status: 'CREATED',
          timestamp: createdAt.toISOString(),
          note: 'tạo đơn',
        },
      ]);
    });

    it('KHÔNG lộ SĐT, địa chỉ người nhận hay thông tin người gửi', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue({
        ...base,
        statusHistory: [],
      });

      const result = await service.findPublicTracking('PCL1');

      expect(Object.keys(result).sort()).toEqual([
        'currentStatus',
        'history',
        'receiverName',
        'trackingCode',
      ]);
    });

    it('không tìm thấy mã -> NotFoundException', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(null);
      await expect(service.findPublicTracking('NOPE')).rejects.toThrow(
        'Không tìm thấy',
      );
    });
  });
});
