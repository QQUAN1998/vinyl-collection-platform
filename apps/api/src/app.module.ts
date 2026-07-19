import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { ApiExceptionFilter } from "./api-exception.filter.js";
import { AuthModule } from "./auth/auth.module.js";
import { AppController } from "./app.controller.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { CloudCollectionsModule } from "./collections/cloud-collections.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { TvDataModule } from "./tv/tv-data.module.js";

@Module({
  imports: [DatabaseModule, AuthModule, CloudCollectionsModule, CatalogModule, TvDataModule],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
