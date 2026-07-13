import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { CloudCollectionPayload, MeResponse } from "@vinyl/shared";

import {
  CloudIdentityService,
  type RequestHeaders,
} from "../cloud/cloud-identity.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CloudCollectionsService } from "./cloud-collections.service.js";

@Controller("api")
export class CloudCollectionsController {
  constructor(
    @Inject(CloudIdentityService)
    private readonly identity: CloudIdentityService,
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(CloudCollectionsService)
    private readonly collections: CloudCollectionsService,
  ) {}

  @Get("me")
  async getMe(@Headers() headers: RequestHeaders): Promise<MeResponse> {
    const user = await this.identity.getCurrentUser(headers);
    return this.authService.getMe(user.id);
  }

  @Get("collections/me")
  async listMine(@Headers() headers: RequestHeaders): Promise<CloudCollectionPayload> {
    const user = await this.identity.getCurrentUser(headers);
    return this.collections.listForUser(user);
  }

  @Post("collections")
  async upsertMine(
    @Headers() headers: RequestHeaders,
    @Body() body: unknown,
  ): Promise<CloudCollectionPayload> {
    const user = await this.identity.getCurrentUser(headers);
    return this.collections.upsertForUser(user, body);
  }

  @Patch("collections/:id")
  async patchMine(
    @Headers() headers: RequestHeaders,
    @Param("id") collectionId: string,
    @Body() body: unknown,
  ): Promise<CloudCollectionPayload> {
    const user = await this.identity.getCurrentUser(headers);
    return this.collections.patchForUser(user, collectionId, body);
  }

  @Delete("collections/:id")
  async deleteMine(
    @Headers() headers: RequestHeaders,
    @Param("id") collectionId: string,
  ): Promise<CloudCollectionPayload> {
    const user = await this.identity.getCurrentUser(headers);
    return this.collections.deleteForUser(user, collectionId);
  }

  @Get("collections/shared/:ownerId")
  async listShared(
    @Headers() headers: RequestHeaders,
    @Param("ownerId") ownerId: string,
  ): Promise<CloudCollectionPayload> {
    await this.identity.getCurrentUser(headers);
    return this.collections.listSharedCollection(ownerId);
  }
}
