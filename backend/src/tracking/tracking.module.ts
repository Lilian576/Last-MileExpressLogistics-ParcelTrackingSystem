import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [AuthModule], // cần JwtService để xác thực tài xế gửi GPS
  providers: [TrackingGateway, PrismaService],
  exports: [TrackingGateway], // ParcelsService cần gọi emitStatusUpdated()
})
export class TrackingModule {}
