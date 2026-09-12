import { Body, Controller, Post, Get, Param, UseGuards, Req, Patch } from '@nestjs/common';
import { CreateParcelDto } from './create-parcel.dto';
import { ParcelsService } from './parcels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateParcelStatusDto } from './update-parcel-status.dto';
import { TransitionActor } from '../state-machine/state-machine.types';

interface CalculateFeeDto {
  weightKg: number;
  senderLat: number;
  senderLng: number;
  receiverLat: number;
  receiverLng: number;
}

interface AuthenticatedRequest {
  user: { userId: string; email: string; role: string };
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
  create(@Body() dto: CreateParcelDto, @Req() req: AuthenticatedRequest) {
    return this.parcelsService.create(dto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.parcelsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.parcelsService.findOne(id);
  }

    @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateParcelStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    // Tạm thời map role trong JWT sang actor của state machine
    const actor = req.user.role as TransitionActor;
    return this.parcelsService.updateStatus(id, dto, actor);
  }
}