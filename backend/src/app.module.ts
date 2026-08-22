import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ParcelsModule } from './parcels/parcels.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [ParcelsModule, TrackingModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
