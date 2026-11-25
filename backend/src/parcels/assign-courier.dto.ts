import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class AssignCourierDto {
  @IsOptional()
  @IsLatitude()
  pickupLat?: number;

  @IsOptional()
  @IsLongitude()
  pickupLng?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  destinationHubId?: string;
}
