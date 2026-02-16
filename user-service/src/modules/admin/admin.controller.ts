import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/users/:userId/sessions')
  getUserSessions(@Param('userId') userId: string) {
    return this.adminService.getUserSessions(userId);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/sessions/:sessionId/revoke')
  revokeSession(@Param('sessionId') sessionId: string) {
    return this.adminService.revokeSession(sessionId);
  }
  @Post('admin/users/:userId/revoke-all')
  revokeAll(@Param('userId') userId: string) {
    return this.adminService.revokeAllSessions(userId);
  }
}
