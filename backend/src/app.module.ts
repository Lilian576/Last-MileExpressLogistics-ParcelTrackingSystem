import { StateMachineModule } from './state-machine/state-machine.module'; 
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ParcelsModule } from './parcels/parcels.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ParcelsModule,
    TrackingModule,
    AuthModule,
StateMachineModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}