import { IsLatitude, IsLongitude } from 'class-validator';

export class AssignCourierDto {
  @IsLatitude()
  pickupLat: number;

  @IsLongitude()
  pickupLng: number;
}
