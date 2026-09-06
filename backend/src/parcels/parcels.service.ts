import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateParcelDto } from './create-parcel.dto';
import { UpdateParcelStatusDto } from './update-parcel-status.dto';
import { StateMachineService } from '../state-machine/state-machine.service';
import { TransitionActor } from '../state-machine/state-machine.types';
interface PricingInput {
  weightKg: number;
  senderLat: number;
  senderLng: number;
  receiverLat: number;
  receiverLng: number;
}

@Injectable()
export class ParcelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
  ) {}

  private readonly BASE_FEE = 15000; // phí cơ bản (VNĐ)
  private readonly PRICE_PER_KG = 5000; // giá theo kg
  private readonly PRICE_PER_KM = 1000; // giá theo km

  calculateFee(input: PricingInput): number {
    const distanceKm = this.calculateDistance(
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

  // Công thức Haversine - tính khoảng cách giữa 2 tọa độ (km)
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
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

    async updateStatus(id: string, dto: UpdateParcelStatusDto, actor: TransitionActor) {
    const parcel = await this.prisma.parcel.findUnique({ where: { id } });

    if (!parcel) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }

    // assertTransition tự throw lỗi nếu transition không hợp lệ — không cần tự kiểm tra thêm
    const newStatus = this.stateMachine.assertTransition(
      parcel.currentStatus,
      dto.event,
      actor,
      dto,
    );

    return this.prisma.parcel.update({
      where: { id },
      data: { currentStatus: newStatus },
    });
  }
}