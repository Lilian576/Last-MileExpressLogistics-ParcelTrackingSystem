import { IsNumber } from 'class-validator';

export class AssignCourierDto {
  @IsNumber()
  pickupLat: number;

  @IsNumber()
  pickupLng: number;
}