import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { json } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Environment } from './config';
export function configureApp(app: INestApplication, env: Environment): void {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(json({ limit: '64kb' }));
  // Parser errors may carry the raw request body. Handle them without logging it.
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    const kind =
      typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;
    if (kind === 'entity.too.large' || kind === 'entity.parse.failed') {
      const status = kind === 'entity.too.large' ? 413 : 400;
      res.status(status).json({
        statusCode: status,
        message: status === 413 ? 'Request body too large' : 'Invalid JSON',
      });
    } else next(error);
  });
  app.enableCors({
    origin: env.WEB_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
}
