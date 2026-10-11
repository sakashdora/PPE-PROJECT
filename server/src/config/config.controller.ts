import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';

@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController {
  constructor(private configService: ConfigService) {}

  @Get('cameras')
  async listCameras(@Req() req: any) {
    return this.configService.listCameras(req.user.role === 'ADMIN');
  }

  @Get('state')
  async state() { return this.configService.state(); }

  @Put('detection')
  @Roles('ADMIN')
  async detection(@Req() req: any, @Body() body: any) { return this.configService.saveDetection(req.user, body); }

  @Post('cameras')
  @Roles('ADMIN')
  async createCamera(@Req() req: any, @Body() body: any) { return this.configService.createCamera(req.user, body); }

  @Put('zones/:id')
  @Roles('ADMIN')
  async updateZone(@Param('id') id: string, @Req() req: any, @Body() body: any) { return this.configService.updateZone(id, req.user, body); }

  @Patch('cameras/:id')
  @Roles('ADMIN')
  async updateCamera(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { name?: string; enabled?: boolean; streamUrl?: string },
  ) {
    return this.configService.updateCamera(id, req.user, body);
  }

  @Post('zones')
  @Roles('ADMIN')
  async createZone(
    @Req() req: any,
    @Body() body: { cameraId: string; kind: string; polygon: number[][] },
  ) {
    return this.configService.createZone(req.user, body);
  }

  @Delete('zones/:id')
  @Roles('ADMIN')
  async deleteZone(@Param('id') id: string, @Req() req: any) {
    return this.configService.deleteZone(id, req.user);
  }

  @Put('thresholds')
  @Roles('ADMIN')
  async updateThresholds(@Req() req: any, @Body() body: Record<string, number>) {
    return this.configService.updateThresholds(req.user, body);
  }

  @Put('params')
  @Roles('ADMIN')
  async updateParams(@Req() req: any, @Body() body: any) {
    return this.configService.updateVoterParams(req.user, body);
  }

  @Get('models')
  async listModels() {
    return this.configService.listModels();
  }

  @Post('models/:id/activate')
  @Roles('ADMIN')
  async activateModel(@Param('id') id: string, @Req() req: any) {
    return this.configService.activateModel(id, req.user);
  }
}
