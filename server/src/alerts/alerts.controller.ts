import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('cameraId') cameraId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.alertsService.listAlerts({
      status,
      severity,
      cameraId,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor ? parseInt(cursor, 10) : undefined,
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.alertsService.getAlertById(id);
  }

  @Get(':id/snapshot')
  async getSnapshot(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const filePath = await this.alertsService.getSnapshotPath(id);
    const file = fs.createReadStream(filePath);
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    });
    return new StreamableFile(file);
  }

  @Patch(':id')
  @Roles('SUPERVISOR', 'ADMIN')
  async transition(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { action: 'ack' | 'resolve' | 'false_alarm'; expectedVersion: number; note?: string },
  ) {
    return this.alertsService.transition(id, req.user, body);
  }
}
