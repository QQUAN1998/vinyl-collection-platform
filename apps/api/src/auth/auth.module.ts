import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { TokenService } from "./token.service.js";
import { MockWechatSessionClient, WECHAT_SESSION_CLIENT } from "./wechat-session.client.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    { provide: WECHAT_SESSION_CLIENT, useClass: MockWechatSessionClient },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
