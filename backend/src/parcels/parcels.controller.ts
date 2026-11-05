import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { CreateParcelDto } from './create-parcel.dto';
import { CalculateFeeDto } from './calculate-fee.dto';
import { ParcelsService } from './parcels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateParcelStatusDto } from './update-parcel-status.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TransitionActor } from '../state-machine/state-machine.types';
import { AssignCourierDto } from './assign-courier.dto';

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

  // Driver UI: danh sách đơn được giao cho shipper đang đăng nhập
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('shipper')
  @Get('assigned/mine')
  findAssignedToMe(@Req() req: AuthenticatedRequest) {
    return this.parcelsService.findAssignedTo(req.user.userId);
  }

  // Danh sách toàn bộ đơn: chỉ nhân sự nội bộ
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'warehouse_staff')
  @Get()
  findAll() {
    return this.parcelsService.findAll();
  }

  // Chi tiết đơn: chỉ người gửi, shipper được giao hoặc nhân sự nội bộ
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.parcelsService.findOneForUser(id, req.user);
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
    return this.parcelsService.updateStatus(id, dto, actor, req.user.userId);
  }

  // Chỉ admin được điều phối; admin đóng vai 'dispatcher' trong state machine
  // (Role enum chưa có dispatcher, transition ASSIGN_COURIER chỉ cho dispatcher/system).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/assign-courier')
  assignCourier(
    @Param('id') id: string,
    @Body() dto: AssignCourierDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.parcelsService.assignCourier(
      id,
      dto,
      'dispatcher',
      req.user.userId,
    );
  }
}
