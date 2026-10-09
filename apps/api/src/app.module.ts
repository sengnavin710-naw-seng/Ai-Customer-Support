import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ENV, loadEnvironment } from './config';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnvironment(process.env) }],
  exports: [ENV],
})
class EnvironmentModule {}
@Module({
  imports: [
    EnvironmentModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    HealthModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
