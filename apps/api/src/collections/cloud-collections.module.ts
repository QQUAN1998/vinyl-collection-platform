import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { CloudIdentityService } from "../cloud/cloud-identity.service.js";
import { DatabaseModule } from "../database/database.module.js";
import { CloudCollectionsController } from "./cloud-collections.controller.js";
import { CloudCollectionsService } from "./cloud-collections.service.js";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [CloudCollectionsController],
  providers: [CloudIdentityService, CloudCollectionsService],
})
export class CloudCollectionsModule {}
