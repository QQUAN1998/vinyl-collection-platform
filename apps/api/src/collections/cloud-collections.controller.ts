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
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { CloudCollectionPayload, MeResponse } from "@vinyl/shared";

import {
  CloudIdentityService,
  getWechatOpenId,
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

  @Post("auth/cloud-login")
  async loginWithCloudIdentity(
    @Headers() headers: RequestHeaders,
    @Body() body: unknown,
  ): Promise<MeResponse> {
    const openId = requireWechatOpenId(headers);
    const profile = parseCloudLoginBody(body);
    return this.authService.loginWithCloudIdentity({
      wechatOpenId: openId,
      ...profile,
    });
  }

  @Post("auth/phone")
  async authorizePhoneNumber(
    @Headers() headers: RequestHeaders,
    @Body() body: unknown,
  ): Promise<MeResponse> {
    const user = await this.identity.getCurrentUser(headers);
    const { code } = parsePhoneAuthorizationBody(body);
    return this.authService.authorizePhoneNumber(user.id, code);
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

  @Post("collections/batch-upsert")
  async upsertManyMine(
    @Headers() headers: RequestHeaders,
    @Body() body: unknown,
  ): Promise<CloudCollectionPayload> {
    const user = await this.identity.getCurrentUser(headers);
    return this.collections.upsertManyForUser(user, body);
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

function requireWechatOpenId(headers: RequestHeaders): string {
  const openId = getWechatOpenId(headers);
  if (!openId) {
    throw new UnauthorizedException();
  }

  return openId;
}

function parseCloudLoginBody(
  value: unknown,
): { displayName?: string; avatarUrl?: string | null } {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "object") {
    throw new UnprocessableEntityException();
  }

  const body = value as Record<string, unknown>;
  const result: { displayName?: string; avatarUrl?: string | null } = {};
  if (body["displayName"] !== undefined) {
    if (typeof body["displayName"] !== "string") {
      throw new UnprocessableEntityException();
    }
    const displayName = body["displayName"].trim().slice(0, 64);
    if (displayName) {
      result.displayName = displayName;
    }
  }
  if (body["avatarUrl"] !== undefined) {
    if (body["avatarUrl"] !== null && typeof body["avatarUrl"] !== "string") {
      throw new UnprocessableEntityException();
    }
    result.avatarUrl =
      body["avatarUrl"] === null ? null : body["avatarUrl"].trim().slice(0, 2048) || null;
  }

  return result;
}

function parsePhoneAuthorizationBody(value: unknown): { code: string } {
  if (typeof value !== "object" || value === null) {
    throw new UnprocessableEntityException();
  }

  const body = value as Record<string, unknown>;
  if (typeof body["code"] !== "string" || !body["code"].trim()) {
    throw new UnprocessableEntityException();
  }

  return { code: body["code"].trim() };
}
