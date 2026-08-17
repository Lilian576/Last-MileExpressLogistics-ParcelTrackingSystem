import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ParcelsModule } from './parcels/parcels.module';
import { AuthModule } from './auth/auth.module';
import { TrackingModule } from './tracking/tracking.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ParcelsModule, AuthModule, TrackingModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
