import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateParcelDto {
  @IsString()
  @IsNotEmpty()
  receiverName: string;

  @IsString()
  @IsNotEmpty()
  receiverPhone: string;

  @IsString()
  @IsNotEmpty()
  receiverAddress: string;

  @IsNumber()
  weightKg: number;

  @IsNumber()
  senderLat: number;

  @IsNumber()
  senderLng: number;

  @IsNumber()
  receiverLat: number;

  @IsNumber()
  receiverLng: number;
}