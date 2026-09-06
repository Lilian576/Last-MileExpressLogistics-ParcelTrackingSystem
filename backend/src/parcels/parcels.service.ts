import { Injectable } from '@nestjs/common';
import { CreateParcelDto } from './create-parcel.dto';

interface PricingInput {
  weightKg: number;
  senderLat: number;
  senderLng: number;
  receiverLat: number;
  receiverLng: number;
}

export interface Parcel {
  id: number;
  trackingCode: string;
  status: string;
  senderName: string;
  receiverName: string;
  weightKg: number;
  fee: number;
  createdAt: Date;
}

@Injectable()
export class ParcelsService {
  private parcels: Parcel[] = [];
  private idCounter = 1;
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
    const R = 6371; // bán kính Trái Đất (km)
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

    create(dto: CreateParcelDto) {
    const fee = this.calculateFee(dto);

    const newParcel = {
      id: this.idCounter++,
      trackingCode: 'PCL' + Date.now(),
      status: 'CREATED',
      senderName: dto.senderName,
      receiverName: dto.receiverName,
      weightKg: dto.weightKg,
      fee: fee,
      createdAt: new Date(),
    };

    this.parcels.push(newParcel);
    return newParcel;
  }

    findAll() {
    return this.parcels;
  }

  findOne(id: number) {
    return this.parcels.find((p) => p.id === id);
  }
}