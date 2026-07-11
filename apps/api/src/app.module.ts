import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { ApiExceptionFilter } from "./api-exception.filter.js";
import { AppController } from "./app.controller.js";
import { DatabaseModule } from "./database/database.module.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
