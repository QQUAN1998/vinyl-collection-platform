import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";

import {
  CloudIdentityService,
  type RequestHeaders,
} from "../cloud/cloud-identity.service.js";
import { TvDataService } from "./tv-data.service.js";

@Controller("cloud/vinyl-data")
export class TvDataController {
  constructor(
    @Inject(TvDataService)
    private readonly tvData: TvDataService,
    @Inject(CloudIdentityService)
    private readonly identity: CloudIdentityService,
  ) {}

  @Get()
  async getLibrary(@Query("userId") userId = "") {
    return this.tvData.getLibraryForUser(userId);
  }

  @Post("tv-login/session")
  async createSession(@Headers() headers: RequestHeaders) {
    return this.tvData.createLoginSession(resolveRequestBaseUrl(headers));
  }

  @Get("tv-login/session/:code")
  async getSession(@Param("code") code: string) {
    return this.tvData.getLoginSession(code);
  }

  @Get("tv-login/:code/scan")
  async scanSession(@Param("code") code: string) {
    return this.tvData.getLoginSession(code);
  }

  @Post("tv-login/session/:code/confirm")
  async confirmSession(
    @Headers() headers: RequestHeaders,
    @Param("code") code: string,
    @Body() body: unknown,
  ) {
    const user = await this.identity.getCurrentUser(headers).catch(() => null);
    return this.tvData.confirmLoginSession(code, body, user || undefined);
  }

  @Post("tv-login/session/:code/proxy-confirm")
  async proxyConfirmSession(
    @Headers() headers: RequestHeaders,
    @Param("code") code: string,
    @Body() body: unknown,
  ) {
    const user = await this.identity.getCurrentUser(headers).catch(() => null);
    return this.tvData.proxyConfirmExternalSession(code, body, user || undefined);
  }
}

function resolveRequestBaseUrl(headers: RequestHeaders): string {
  const host = firstHeader(headers["x-forwarded-host"])
    || firstHeader(headers["host"])
    || "";
  const protocol = firstHeader(headers["x-forwarded-proto"]) || "https";
  if (!host) {
    return "";
  }
  return `${protocol.split(",")[0]?.trim() || "https"}://${host.split(",")[0]?.trim() || host}`;
}

function firstHeader(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  return (first || "").trim();
}
