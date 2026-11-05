import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ParcelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { haversineKm } from '../common/geo';
import { CreateParcelDto } from './create-parcel.dto';
import { UpdateParcelStatusDto } from './update-parcel-status.dto';
import { StateMachineService } from '../state-machine/state-machine.service';
import { DriverAssignmentService } from './driver-assignment.service';
import { AssignCourierDto } from './assign-courier.dto';
import {
  TransitionContext,
  TransitionEvent,
  TransitionActor,
} from '../state-machine/state-machine.types';
import { TERMINAL_STATES } from '../state-machine/transition-table';
import { TrackingGateway } from '../tracking/tracking.gateway';

interface PricingInput {
  weightKg: number;
  senderLat: number;
  senderLng: number;
  receiverLat: number;
  receiverLng: number;
}

// Chỉ các actor nội bộ mới được khai báo vị trí hub; shipper/customer không được tự khai.
const HUB_REPORTING_ACTORS: TransitionActor[] = [
  'warehouse_staff',
  'dispatcher',
  'admin',
  'system',
];
const ACTIVE_ASSIGNMENT_STATUSES = [
  'assigned',
  'accepted',
  'in_progress',
] as const;

@Injectable()
export class ParcelsService {
  private readonly logger = new Logger(ParcelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly driverAssignment: DriverAssignmentService,
    private readonly trackingGateway: TrackingGateway,
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

  // senderId lấy từ tài khoản đang đăng nhập (JWT), không phải khách tự gõ
  async create(dto: CreateParcelDto, senderId: string) {
    const fee = this.calculateFee(dto);

    const parcel = await this.prisma.parcel.create({
      data: {
        trackingCode: 'PCL' + Date.now(),
        senderId: senderId,
        receiverName: dto.receiverName,
        receiverPhone: dto.receiverPhone,
        receiverAddress: dto.receiverAddress,
        weightKg: dto.weightKg,
      },
    });

    // fee không lưu DB (Prisma không có cột này), chỉ tính rồi trả về kèm response
    return { ...parcel, fee };
  }

  async findAll() {
    return this.prisma.parcel.findMany();
  }

  async findOne(id: string) {
    return this.prisma.parcel.findUnique({ where: { id } });
  }

  // Chỉ người gửi, shipper đang được giao đơn, hoặc nhân sự nội bộ mới xem được chi tiết
  async findOneForUser(id: string, user: { userId: string; role: string }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id },
      include: { assignments: { select: { courierId: true } } },
    });
    if (!parcel) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }
    const allowed =
      user.role === 'admin' ||
      user.role === 'warehouse_staff' ||
      parcel.senderId === user.userId ||
      parcel.assignments.some((a) => a.courierId === user.userId);
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
      ...(h.note ? { note: h.note } : {}),
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

  // Context cho guard của state machine: lấy từ DB / vai trò đã xác thực,
  // KHÔNG tin các boolean guard do client gửi (xem docs/INTEGRATION.md).
  private async buildTrustedContext(
    parcel: { id: string; failedAttemptCount: number; updatedAt: Date },
    dto: UpdateParcelStatusDto,
    actor: TransitionActor,
    userId?: string,
  ): Promise<TransitionContext> {
    const isAssignedCourier =
      actor === 'shipper' && userId
        ? (await this.prisma.deliveryAssignment.count({
            where: {
              parcelId: parcel.id,
              courierId: userId,
              status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
            },
          })) > 0
        : false;

    const staff = HUB_REPORTING_ACTORS.includes(actor);
    return {
      isAssignedCourier,
      failedAttemptCount: parcel.failedAttemptCount,
      hoursSinceLastUpdate:
        (Date.now() - parcel.updatedAt.getTime()) / 3_600_000,
      // Gán courier phải đi qua PATCH :id/assign-courier, không qua endpoint này
      hasAvailableCourier: false,
      isHubLocation: staff ? dto.isHubLocation : false,
      isFinalHub: staff ? dto.isFinalHub : undefined,
      // TODO: schema chưa lưu bằng chứng giao hàng -> tạm tin cờ từ shipper
      hasDeliveryProof: actor === 'shipper' ? dto.hasDeliveryProof : false,
    };
  }

  // Ghi trạng thái mới + history (+ side effect) trong 1 transaction, có khóa lạc quan theo
  // trạng thái cũ để 2 request song song không ghi đè nhau. Emit WebSocket SAU KHI commit.
  private async commitTransition<T = undefined>(
    parcel: { id: string; currentStatus: ParcelStatus },
    newStatus: ParcelStatus,
    changedBy: string | undefined,
    sideEffect?: (tx: Prisma.TransactionClient) => Promise<T>,
    extraData: Prisma.ParcelUpdateManyMutationInput = {},
  ) {
    const { updated, history, extra } = await this.prisma.$transaction(
      async (tx) => {
        const res = await tx.parcel.updateMany({
          where: { id: parcel.id, currentStatus: parcel.currentStatus },
          data: { currentStatus: newStatus, ...extraData },
        });
        if (res.count !== 1) {
          throw new ConflictException(
            'Trạng thái đơn hàng vừa thay đổi, vui lòng tải lại và thử lại',
          );
        }
        const history = await tx.parcelStatusHistory.create({
          data: {
            parcelId: parcel.id,
            status: newStatus,
            changedBy: changedBy ?? null,
          },
        });
        const extra = sideEffect ? await sideEffect(tx) : undefined;
        const updated = await tx.parcel.findUniqueOrThrow({
          where: { id: parcel.id },
        });
        return { updated, history, extra };
      },
    );

    // Lỗi emit sau commit KHÔNG được làm request thất bại / giả vờ rollback
    try {
      this.trackingGateway.emitStatusUpdated({
        trackingCode: updated.trackingCode,
        currentStatus: newStatus,
        event: {
          status: newStatus,
          timestamp: history.createdAt.toISOString(),
        },
      });
    } catch (err) {
      this.logger.error(
        `Emit realtime thất bại cho ${updated.trackingCode}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return { updated, extra: extra as T };
  }

  async updateStatus(
    id: string,
    dto: UpdateParcelStatusDto,
    actor: TransitionActor,
    changedByUserId?: string,
  ) {
    const parcel = await this.prisma.parcel.findUnique({ where: { id } });
    if (!parcel) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }

    if (dto.event === TransitionEvent.ASSIGN_COURIER) {
      throw new BadRequestException('Use the assign-courier endpoint');
    }

    const ctx = await this.buildTrustedContext(
      parcel,
      dto,
      actor,
      changedByUserId,
    );
    // assertTransition tự throw lỗi nếu transition không hợp lệ
    const newStatus = this.stateMachine.assertTransition(
      parcel.currentStatus,
      dto.event,
      actor,
      ctx,
    );

    const { updated } = await this.commitTransition(
      parcel,
      newStatus,
      changedByUserId,
      undefined,
      dto.event === TransitionEvent.REPORT_FAILED_DELIVERY
        ? { failedAttemptCount: { increment: 1 } }
        : {},
    );
    return updated;
  }

  async assignCourier(
    parcelId: string,
    dto: AssignCourierDto,
    actor: TransitionActor,
    changedByUserId?: string,
  ) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
    });
    if (!parcel) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${parcelId}`);
    }

    const nearest = await this.driverAssignment.findNearestAvailableCourier(
      dto.pickupLat,
      dto.pickupLng,
    );

    // Validate TRƯỚC khi ghi bất cứ thứ gì: transition bị từ chối thì DB không đổi
    const newStatus = this.stateMachine.assertTransition(
      parcel.currentStatus,
      TransitionEvent.ASSIGN_COURIER,
      actor,
      { hasAvailableCourier: nearest.found },
    );
    if (!nearest.found) {
      throw new ConflictException(nearest.reason);
    }

    const { updated, extra: assignment } = await this.commitTransition(
      parcel,
      newStatus,
      changedByUserId,
      (tx) =>
        this.driverAssignment.createPickupAssignment(
          tx,
          parcel.id,
          nearest.courier.id,
        ),
    );

    return {
      parcel: updated,
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
  }
}
