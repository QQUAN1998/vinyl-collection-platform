import { Controller, Get } from "@nestjs/common";

import { getSystemInfo } from "./system-info.js";

@Controller()
export class AppController {
  @Get("health")
  getHealth(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("v1/system/info")
  getPublicSystemInfo(): ReturnType<typeof getSystemInfo> {
    return getSystemInfo();
  }
}
