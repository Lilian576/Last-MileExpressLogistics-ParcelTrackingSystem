import { Controller, Get, Param } from '@nestjs/common';
import { ParcelsService } from './parcels.service';

// Route công khai cho trang tra cứu của khách (không cần JWT).
// Frontend gọi: GET /api/public/track/:code
@Controller('api/public')
export class PublicTrackingController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Get('track/:code')
  track(@Param('code') code: string) {
    return this.parcelsService.findPublicTracking(code.trim());
  }
}
