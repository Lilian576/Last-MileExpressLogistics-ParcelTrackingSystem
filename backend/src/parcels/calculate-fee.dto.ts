import { IsLatitude, IsLongitude, IsNumber, Max, Min } from 'class-validator';

export class CalculateFeeDto {
  @IsNumber()
  @Min(0)
  @Max(1000)
  weightKg: number;

  @IsLatitude()
  senderLat: number;

  @IsLongitude()
  senderLng: number;

  @IsLatitude()
  receiverLat: number;

  @IsLongitude()
  receiverLng: number;
}
