export class CreateParcelDto {
  senderName: string;
  senderLat: number;
  senderLng: number;

  receiverName: string;
  receiverLat: number;
  receiverLng: number;

  weightKg: number;
}