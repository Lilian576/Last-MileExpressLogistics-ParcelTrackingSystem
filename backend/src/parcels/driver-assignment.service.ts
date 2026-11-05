import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { haversineKm } from '../common/geo';

export type NearestCourierResult =
  | { found: true; courier: User; distanceKm: number }
  | { found: false; reason: string };

const ACTIVE_ASSIGNMENT_STATUSES = [
  'assigned',
  'accepted',
  'in_progress',
] as const;

@Injectable()
export class DriverAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  // Chỉ TÌM shipper gần nhất đang rảnh, KHÔNG ghi DB.
  // Việc tạo assignment do ParcelsService làm trong cùng transaction với đổi trạng thái.
  async findNearestAvailableCourier(
    pickupLat: number,
    pickupLng: number,
  ): Promise<NearestCourierResult> {
    const shippers = await this.prisma.user.findMany({
      where: {
        role: 'shipper',
        isActive: true,
        currentLatitude: { not: null },
        currentLongitude: { not: null },
        assignments: {
          none: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
        },
      },
    });

    let nearest: { courier: User; distanceKm: number } | null = null;
    for (const courier of shippers) {
      const distanceKm = haversineKm(
        pickupLat,
        pickupLng,
        Number(courier.currentLatitude),
        Number(courier.currentLongitude),
      );
      if (!nearest || distanceKm < nearest.distanceKm) {
        nearest = { courier, distanceKm };
      }
    }

    if (!nearest) {
      return { found: false, reason: 'Không có shipper nào đang rảnh' };
    }
    return { found: true, ...nearest };
  }

  createPickupAssignment(
    tx: Prisma.TransactionClient,
    parcelId: string,
    courierId: string,
  ) {
    return tx.deliveryAssignment.create({
      data: {
        parcelId,
        courierId,
        assignmentType: 'pickup',
        status: 'assigned',
      },
    });
  }
}
