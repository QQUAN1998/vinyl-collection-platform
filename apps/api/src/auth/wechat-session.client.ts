import { Injectable, UnauthorizedException } from "@nestjs/common";

export const WECHAT_SESSION_CLIENT = Symbol("WECHAT_SESSION_CLIENT");

export interface WechatSession {
  openId: string;
}

export interface WechatSessionClient {
  exchangeCode(code: string): Promise<WechatSession>;
}

@Injectable()
export class MockWechatSessionClient implements WechatSessionClient {
  async exchangeCode(code: string): Promise<WechatSession> {
    if (!code.startsWith("mock:")) {
      throw new UnauthorizedException();
    }

    const mockId = code.slice("mock:".length).trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(mockId)) {
      throw new UnauthorizedException();
    }

    return { openId: `mock-openid-${mockId}` };
  }
}
