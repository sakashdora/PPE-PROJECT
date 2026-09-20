import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as crypto from 'crypto';
import { EdgeService } from './edge.service';
import { EdgeAuthGuard } from './edge-auth.guard';

@Controller('edge')
@UseGuards(EdgeAuthGuard)
export class EdgeController {
  constructor(private edgeService: EdgeService) {}

  @Post('alerts')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('snapshot'))
  async ingestAlert(
    @Req() req: any,
    @Body() body: any,
    @UploadedFile() file?: any,
  ) {
    // If sent as JSON or form-data with JSON payload
    let dto = body;
    if (body.payload && typeof body.payload === 'string') {
      try {
        dto = JSON.parse(body.payload);
      } catch {}
    } else if (body.data && typeof body.data === 'string') {
      try {
        dto = JSON.parse(body.data);
      } catch {}
    }

    const snapshotBuffer = file ? file.buffer : undefined;
    return this.edgeService.ingestAlert(req.edgeNode, dto, snapshotBuffer);
  }

  @Post('heartbeat')
  @HttpCode(200)
  async heartbeat(@Req() req: any, @Body() body: any) {
    return this.edgeService.processHeartbeat(req.edgeNode, body);
  }

  @Get('config')
  async getConfig(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ) {
    const config = await this.edgeService.getConfig(req.edgeNode);
    const etag = `W/"${crypto.createHash('md5').update(JSON.stringify(config)).digest('hex')}"`;

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return;
    }

    res.setHeader('ETag', etag);
    return config;
  }
}
