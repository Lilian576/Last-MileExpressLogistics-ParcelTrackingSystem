import { Module } from '@nestjs/common';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';
import { PrismaService } from '../common/prisma.service';
import { StateMachineModule } from '../state-machine/state-machine.module';
import { DriverAssignmentService } from './driver-assignment.service';

@Module({
  imports: [StateMachineModule],
  controllers: [ParcelsController],
  providers: [ParcelsService, PrismaService, DriverAssignmentService],
})
export class ParcelsModule {}