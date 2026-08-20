import { Body, Controller, Post } from '@nestjs/common';
import { ParcelsService } from './parcels.service';

interface CalculateFeeDto {
  weightKg: number;
  senderLat: number;
  senderLng: number;
  receiverLat: number;
  receiverLng: number;
}

@Controller('api/parcels')
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post('calculate-fee')
  calculateFee(@Body() dto: CalculateFeeDto) {
    const fee = this.parcelsService.calculateFee(dto);
    return {
      fee,
      currency: 'VND',
      details: {
        weightKg: dto.weightKg,
      },
    };
  }
}