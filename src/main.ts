import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as helmet from 'helmet';
import * as fs from 'fs';

async function bootstrap() {
  let app;
  const port = process.env.PORT || 8000;
  if (process.env.ENVIRONMENT !== 'DEVELOPMENT') {
    app = await NestFactory.create(AppModule, {
      httpsOptions: {
        key: fs.readFileSync(process.env.PRIVATE_KEY_FILE),
        cert: fs.readFileSync(process.env.CERT_FILE),
      },
    });
  } else {
    app = await NestFactory.create(AppModule);
  }
  app.enableCors();
  app.use(helmet());
  await app.listen(port);
}

bootstrap();
