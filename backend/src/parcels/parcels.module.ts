import { Module } from '@nestjs/common';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';
import { PrismaService } from '../common/prisma.service';
import { StateMachineModule } from '../state-machine/state-machine.module';

@Module({
  imports: [StateMachineModule],
  controllers: [ParcelsController],
  providers: [ParcelsService, PrismaService],
})
export class ParcelsModule {}