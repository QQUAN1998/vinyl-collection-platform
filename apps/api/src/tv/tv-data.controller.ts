import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
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
