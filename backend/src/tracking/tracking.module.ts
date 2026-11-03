import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';

@Module({
  providers: [TrackingGateway],
  exports: [TrackingGateway], // ParcelsService cần gọi emitStatusUpdated()
})
export class TrackingModule {}
