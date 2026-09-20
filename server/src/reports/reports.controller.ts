import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('compliance')
  @Roles('SUPERVISOR', 'ADMIN')
  async exportComplianceCsv(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    const csvData = await this.reportsService.generateComplianceCsv({ from, to, status });
    const filename = `compliance_report_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvData);
  }

  @Get('aggregates')
  async getAggregates() {
    return this.reportsService.getAggregates();
  }
}
