import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ParcelsModule } from './parcels/parcels.module';

@Module({
  imports: [ParcelsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
