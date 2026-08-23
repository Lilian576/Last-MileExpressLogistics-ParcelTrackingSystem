import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Dùng: @UseGuards(JwtAuthGuard) trên controller/route cần bắt buộc đăng nhập
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
