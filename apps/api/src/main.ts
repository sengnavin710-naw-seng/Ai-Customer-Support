import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { ENV } from './config';
import type { Environment } from './config';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const env = app.get<Environment>(ENV);
  configureApp(app, env);
  await app.listen(env.API_PORT, '127.0.0.1');
}
void bootstrap();
