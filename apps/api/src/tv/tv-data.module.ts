import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { CloudIdentityService } from "../cloud/cloud-identity.service.js";
import { DatabaseModule } from "../database/database.module.js";
import { TvDataController } from "./tv-data.controller.js";
import { TvDataService } from "./tv-data.service.js";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [TvDataController],
  providers: [CloudIdentityService, TvDataService],
})
export class TvDataModule {}
