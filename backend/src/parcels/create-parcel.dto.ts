import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { CalculateFeeDto } from './calculate-fee.dto';

export class CreateParcelDto extends CalculateFeeDto {
  @IsString()
  @IsNotEmpty()
  receiverName: string;

  @IsString()
  @IsNotEmpty()
  receiverPhone: string;

  @IsString()
  @IsNotEmpty()
  receiverAddress: string;

  @IsOptional()
  @IsString()
  dimensions?: string;
}
