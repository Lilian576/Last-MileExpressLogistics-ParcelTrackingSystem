import { Module } from '@nestjs/common';
import { ParcelsController } from './parcels.controller';
import { PublicTrackingController } from './public-tracking.controller';
import { ParcelsService } from './parcels.service';
import { PrismaService } from '../common/prisma.service';
import { StateMachineModule } from '../state-machine/state-machine.module';
import { DriverAssignmentService } from './driver-assignment.service';
import { ParcelNotifierService } from './parcel-notifier.service';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [StateMachineModule, TrackingModule],
  controllers: [ParcelsController, PublicTrackingController],
  providers: [
    ParcelsService,
    PrismaService,
    DriverAssignmentService,
    ParcelNotifierService,
  ],
})
export class ParcelsModule {}
