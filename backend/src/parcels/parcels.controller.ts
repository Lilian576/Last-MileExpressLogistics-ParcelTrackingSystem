import { Body, Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { CreateParcelDto } from './create-parcel.dto';
import { ParcelsService } from './parcels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateParcelDto) {
    return this.parcelsService.create(dto);
    
  }

  @Get()
  findAll() {
    return this.parcelsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.parcelsService.findOne(Number(id));
  }
}