import { getSystemInfo } from "./system-info.js";

export interface ApiResponse {
  status: number;
  body: object;
}

export function routeRequest(method: string, path: string): ApiResponse {
  if (method === "GET" && path === "/health") {
    return { status: 200, body: { status: "ok" } };
  }

  if (method === "GET" && path === "/v1/system/info") {
    return { status: 200, body: getSystemInfo() };
  }

  return {
    status: 404,
    body: { code: "NOT_FOUND", message: "Route not found" },
  };
}
