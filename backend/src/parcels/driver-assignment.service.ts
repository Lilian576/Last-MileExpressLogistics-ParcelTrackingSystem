import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AssignmentType, AssignmentStatus } from '@prisma/client';

@Injectable()
export class DriverAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  // Công thức Haversine - giống hệt cách tính trong ParcelsService
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

  // Tìm shipper gần nhất đang rảnh, gán vào đơn hàng
  async assignNearestCourier(
    parcelId: string,
    pickupLat: number,
    pickupLng: number,
  ) {
    const parcel = await this.prisma.parcel.findUnique({ where: { id: parcelId } });
    if (!parcel) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${parcelId}`);
    }

    // Lấy tất cả shipper có vị trí, chưa có assignment nào đang xử lý dở
    const availableShippers = await this.prisma.user.findMany({
      where: {
        role: 'shipper',
        currentLatitude: { not: null },
        currentLongitude: { not: null },
        assignments: {
          none: {
            status: { in: ['assigned', 'accepted', 'in_progress'] },
          },
        },
      },
    });

    if (availableShippers.length === 0) {
      return { found: false, reason: 'Không có shipper nào đang rảnh' };
    }

    // Tìm shipper gần nhất
    let nearest = availableShippers[0];
    let minDistance = this.calculateDistance(
      pickupLat,
      pickupLng,
      Number(nearest.currentLatitude),
      Number(nearest.currentLongitude),
    );

    for (const shipper of availableShippers) {
      const distance = this.calculateDistance(
        pickupLat,
        pickupLng,
        Number(shipper.currentLatitude),
        Number(shipper.currentLongitude),
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = shipper;
      }
    }

    // Tạo delivery assignment
    const assignment = await this.prisma.deliveryAssignment.create({
      data: {
        parcelId: parcel.id,
        courierId: nearest.id,
        assignmentType: AssignmentType.pickup,
        status: AssignmentStatus.assigned,
      },
    });

    return { found: true, courier: nearest, distanceKm: minDistance, assignment };
  }
}