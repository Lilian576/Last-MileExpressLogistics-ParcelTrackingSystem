export class CreateParcelDto {
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weightKg: number;

  // Dùng để tính phí, không lưu trực tiếp vào Parcel (Prisma không có cột này)
  senderLat: number;
  senderLng: number;
  receiverLat: number;
  receiverLng: number;
}