import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Parcel,
  ParcelStatus,
  ParcelStatusHistory,
  Prisma,
  Role,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../common/prisma.service';
import { haversineKm } from '../common/geo';
import { CreateParcelDto } from './create-parcel.dto';
import { UpdateParcelStatusDto } from './update-parcel-status.dto';
import { StateMachineService } from '../state-machine/state-machine.service';
import { DriverAssignmentService } from './driver-assignment.service';
import { AssignCourierDto } from './assign-courier.dto';
import {
  TransitionEvent,
  TransitionActor,
} from '../state-machine/state-machine.types';
import { TERMINAL_STATES } from '../state-machine/transition-table';
import { ParcelNotifierService } from './parcel-notifier.service';

interface PricingInput {
  weightKg: number;
  senderLat: number;
  senderLng: number;
  receiverLat: number;
  receiverLng: number;
}

const ACTIVE_ASSIGNMENT_STATUSES = [
  'assigned',
  'accepted',
  'in_progress',
] as const;

@Injectable()
export class ParcelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly driverAssignment: DriverAssignmentService,
    private readonly notifier: ParcelNotifierService,
  ) {}

  private readonly BASE_FEE = 15000; // phí cơ bản (VNĐ)
  private readonly PRICE_PER_KG = 5000; // giá theo kg
  private readonly PRICE_PER_KM = 1000; // giá theo km

  calculateFee(input: PricingInput): number {
    const distanceKm = haversineKm(
      input.senderLat,
      input.senderLng,
      input.receiverLat,
      input.receiverLng,
    );

    const fee =
      this.BASE_FEE +
      input.weightKg * this.PRICE_PER_KG +
      distanceKm * this.PRICE_PER_KM;

    return Math.round(fee);
  }

  async create(dto: CreateParcelDto, senderId: string) {
    const currentStatus = this.stateMachine.assertTransition(
      null,
      TransitionEvent.CREATE_PARCEL,
      'customer',
    );
    const parcel = await this.prisma.parcel.create({
      data: {
        ...dto,
        feeVnd: this.calculateFee(dto),
        trackingCode: 'PCL' + randomBytes(16).toString('hex'),
        senderId,
        currentStatus,
        statusHistory: {
          create: { status: currentStatus, changedBy: senderId },
        },
      },
      include: { statusHistory: true },
    });
    const { statusHistory, ...created } = parcel;
    this.notify(created, statusHistory[0], null, 'customer');
    return { ...created, fee: created.feeVnd };
  }

  findHubs() {
    return this.prisma.location.findMany({
      where: { type: 'hub' },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.parcel.findMany();
  }

  async findMine(senderId: string) {
    return this.prisma.parcel.findMany({
      where: { senderId },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Chỉ người gửi, shipper đang được giao đơn, hoặc nhân sự nội bộ mới xem được chi tiết
  async findOneForUser(id: string, user: { userId: string; role: string }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
          select: { courierId: true },
        },
      },
    });
    if (!parcel) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }
    const allowed =
      user.role === 'admin' ||
      user.role === 'warehouse_staff' ||
      parcel.senderId === user.userId ||
      (user.role === 'shipper' &&
        parcel.assignments.some((a) => a.courierId === user.userId));
    if (!allowed) {
      // Trả 404 thay vì 403 để không lộ sự tồn tại của đơn người khác
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }
    const { assignments, ...rest } = parcel;
    void assignments;
    return rest;
  }

  // Tra cứu công khai theo mã vận đơn (không cần đăng nhập). Chỉ trả thông tin tối thiểu:
  // KHÔNG trả SĐT/địa chỉ người nhận hay thông tin người gửi.
  async findPublicTracking(trackingCode: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { trackingCode },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
    });

    if (!parcel) {
      throw new NotFoundException(
        `Không tìm thấy đơn hàng với mã ${trackingCode}`,
      );
    }

    const history: {
      status: ParcelStatus;
      timestamp: string;
      note?: string;
    }[] = parcel.statusHistory.map((h) => ({
      status: h.status,
      timestamp: h.createdAt.toISOString(),
    }));

    // create() chưa ghi mốc CREATED vào lịch sử -> bổ sung từ createdAt để timeline đủ
    if (history[0]?.status !== ParcelStatus.CREATED) {
      history.unshift({
        status: ParcelStatus.CREATED,
        timestamp: parcel.createdAt.toISOString(),
      });
    }

    return {
      trackingCode: parcel.trackingCode,
      currentStatus: parcel.currentStatus,
      receiverName: parcel.receiverName,
      history,
      location:
        parcel.driverLatitude != null &&
        parcel.driverLongitude != null &&
        parcel.driverLocationAt
          ? {
              trackingCode,
              latitude: Number(parcel.driverLatitude),
              longitude: Number(parcel.driverLongitude),
              timestamp: parcel.driverLocationAt.toISOString(),
            }
          : null,
    };
  }

  // Đơn đang được giao cho shipper này (dùng cho Driver UI). Đơn đã kết thúc không trả về.
  async findAssignedTo(courierId: string) {
    const assignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        courierId,
        status: { in: ['assigned', 'accepted', 'in_progress'] },
        parcel: { currentStatus: { notIn: TERMINAL_STATES } },
      },
      include: { parcel: true },
      orderBy: { assignedAt: 'desc' },
    });
    // 1 đơn có thể có nhiều assignment (pickup + last_mile) -> khử trùng theo id
    return [
      ...new Map(assignments.map((a) => [a.parcel.id, a.parcel])).values(),
    ];
  }

  private notify(
    parcel: Parcel,
    history: ParcelStatusHistory,
    from: ParcelStatus | null,
    actor: TransitionActor,
  ) {
    // Webhook có timeout riêng. REST trả kết quả sau khi DB đã commit.
    void this.notifier.onTransition(
      parcel.id,
      from,
      parcel.currentStatus,
      actor,
      {
        id: history.id,
        update: {
          trackingCode: parcel.trackingCode,
          currentStatus: parcel.currentStatus,
          event: {
            status: history.status,
            timestamp: history.createdAt.toISOString(),
          },
        },
      },
    );
  }

  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Đơn hoặc tài xế vừa thay đổi. Vui lòng tải lại.',
        );
      }
      throw error;
    }
  }

  private async getParcel(tx: Prisma.TransactionClient, id: string) {
    const parcel = await tx.parcel.findUnique({ where: { id } });
    if (!parcel) throw new NotFoundException('Không tìm thấy đơn hàng');
    return parcel;
  }

  private async changeStatus(
    tx: Prisma.TransactionClient,
    parcel: Parcel,
    status: ParcelStatus,
    userId: string,
    data: Prisma.ParcelUncheckedUpdateInput = {},
  ) {
    const updated = await tx.parcel.update({
      where: { id: parcel.id },
      data: { ...data, currentStatus: status },
    });
    const history = await tx.parcelStatusHistory.create({
      data: {
        parcelId: parcel.id,
        status,
        changedBy: userId,
        locationId: updated.currentLocationId,
      },
    });
    return { updated, history };
  }

  async updateStatus(
    id: string,
    dto: UpdateParcelStatusDto,
    user: { userId: string; role: Role },
  ) {
    const { event } = dto;
    if (event === TransitionEvent.ASSIGN_COURIER) {
      throw new BadRequestException(
        'Dùng API assign-courier để gán tài xế lấy hàng',
      );
    }
    const actor = user.role === 'admin' ? 'dispatcher' : user.role;
    const result = await this.transaction(async (tx) => {
      const parcel = await this.getParcel(tx, id);
      const assignments = await tx.deliveryAssignment.findMany({
        where: {
          parcelId: id,
          status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
        },
      });
      const isAssignedCourier = assignments.some(
        (assignment) => assignment.courierId === user.userId,
      );
      if (
        (actor === 'shipper' && !isAssignedCourier) ||
        (actor === 'customer' && parcel.senderId !== user.userId)
      ) {
        throw new ForbiddenException('Bạn không có quyền cập nhật đơn này');
      }

      const hub =
        dto.hubId && event === TransitionEvent.ARRIVE_AT_HUB
          ? await tx.location.findFirst({
              where: { id: dto.hubId, type: 'hub' },
            })
          : null;
      const isFinalHub =
        parcel.currentLocationId !== null &&
        parcel.currentLocationId === parcel.destinationLocationId;
      const proof = dto.deliveryProofRef?.trim();
      const status = this.stateMachine.assertTransition(
        parcel.currentStatus,
        event,
        actor,
        {
          isAssignedCourier,
          isHubLocation: hub !== null,
          isFinalHub,
          hasDeliveryProof: Boolean(proof),
          failedAttemptCount: parcel.failedAttemptCount,
        },
      );

      const data: Prisma.ParcelUncheckedUpdateInput = {};
      if (hub) data.currentLocationId = hub.id;
      if (event === TransitionEvent.CONFIRM_DELIVERY)
        data.deliveryProof = proof;
      data.deliveredAt = new Date();
      if (event === TransitionEvent.REPORT_FAILED_DELIVERY) {
        data.failedAttemptCount = { increment: 1 };
      }

      if (event === TransitionEvent.CONFIRM_PICKUP) {
        await tx.deliveryAssignment.updateMany({
          where: {
            parcelId: id,
            courierId: user.userId,
            status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
          },
          data: { status: 'in_progress' },
        });
      }
      if (event === TransitionEvent.DISPATCH_LAST_MILE) {
        const finalHub = await tx.location.findUniqueOrThrow({
          where: { id: parcel.currentLocationId! },
        });
        const nearest = await this.driverAssignment.findNearestAvailableCourier(
          Number(finalHub.latitude),
          Number(finalHub.longitude),
          tx,
        );
        if (!nearest.found) throw new ConflictException(nearest.reason);
        await this.driverAssignment.createAssignment(
          tx,
          id,
          nearest.courier.id,
          'last_mile',
        );
        data.driverLatitude = null;
        data.driverLongitude = null;
        data.driverLocationAt = null;
      }
      if (
        status === 'CANCELLED' ||
        status === 'DELIVERED' ||
        status === 'RETURNED' ||
        (hub && hub.id === parcel.destinationLocationId)
      ) {
        await tx.deliveryAssignment.updateMany({
          where: {
            parcelId: id,
            status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
          },
          data: {
            status: status === 'CANCELLED' ? 'cancelled' : 'completed',
            completedAt: new Date(),
          },
        });
      }
      return {
        ...(await this.changeStatus(tx, parcel, status, user.userId, data)),
        from: parcel.currentStatus,
      };
    });

    this.notify(result.updated, result.history, result.from, actor);
    return result.updated;
  }

  async assignCourier(id: string, dto: AssignCourierDto, userId: string) {
    const result = await this.transaction(async (tx) => {
      const parcel = await this.getParcel(tx, id);
      const destinationHubId =
        dto.destinationHubId ?? parcel.destinationLocationId;
      if (
        !destinationHubId ||
        !(await tx.location.findFirst({
          where: { id: destinationHubId, type: 'hub' },
        }))
      ) {
        throw new BadRequestException('Chọn hub phụ trách giao hàng');
      }
      const hasStoredCoordinates =
        parcel.senderLat !== null && parcel.senderLng !== null;
      const pickupLat = hasStoredCoordinates
        ? Number(parcel.senderLat)
        : dto.pickupLat;
      const pickupLng = hasStoredCoordinates
        ? Number(parcel.senderLng)
        : dto.pickupLng;
      if (pickupLat === undefined || pickupLng === undefined) {
        throw new BadRequestException('Đơn cũ cần tọa độ lấy hàng');
      }

      const nearest = await this.driverAssignment.findNearestAvailableCourier(
        pickupLat,
        pickupLng,
        tx,
      );
      if (!nearest.found) throw new ConflictException(nearest.reason);
      const status = this.stateMachine.assertTransition(
        parcel.currentStatus,
        TransitionEvent.ASSIGN_COURIER,
        'dispatcher',
        { hasAvailableCourier: true },
      );
      const assignment = await this.driverAssignment.createAssignment(
        tx,
        id,
        nearest.courier.id,
        'pickup',
      );
      return {
        ...(await this.changeStatus(tx, parcel, status, userId, {
          destinationLocationId: destinationHubId,
        })),
        from: parcel.currentStatus,
        assignmentResult: {
          found: true,
          courier: {
            id: nearest.courier.id,
            fullName: nearest.courier.fullName,
          },
          distanceKm: nearest.distanceKm,
          assignment,
        },
      };
    });

    this.notify(result.updated, result.history, result.from, 'dispatcher');
    return {
      parcel: result.updated,
      assignmentResult: result.assignmentResult,
    };
  }
}
