import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import type { Health } from '@support/contracts';
import { Public, Roles } from '../auth/auth.guard';
import { DatabaseModule, DatabaseService } from '../database/database.module';
@Controller('health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  @Public() @Get() live(): Health {
    return { status: 'ok', service: 'support-api', timestamp: new Date().toISOString() };
  }
  @Roles('admin') @Get('ready') async ready() {
    if (!(await this.database.isReady()))
      throw new ServiceUnavailableException('Database unavailable');
    return { status: 'ok', database: 'connected' };
  }
}
@Module({ imports: [DatabaseModule], controllers: [HealthController] })
export class HealthModule {}
