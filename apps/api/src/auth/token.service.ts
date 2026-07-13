import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export interface TokenClaims {
  sub: string;
}

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class TokenService {
  sign({ sub }: TokenClaims): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      sub,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = signPayload(encodedPayload, getAuthTokenSecret(process.env));

    return `${encodedPayload}.${signature}`;
  }

  verify(token: string): TokenClaims {
    const [encodedPayload, signature, extra] = token.split(".");
    if (!encodedPayload || !signature || extra !== undefined) {
      throw new UnauthorizedException();
    }

    const expectedSignature = signPayload(encodedPayload, getAuthTokenSecret(process.env));
    if (!constantTimeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException();
    }

    const payload = parsePayload(encodedPayload);
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException();
    }

    return { sub: payload.sub };
  }
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parsePayload(encodedPayload: string): TokenPayload {
  try {
    const value = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    if (!isTokenPayload(value)) {
      throw new Error("Invalid payload");
    }
    return value;
  } catch {
    throw new UnauthorizedException();
  }
}

function isTokenPayload(value: unknown): value is TokenPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    typeof payload["sub"] === "string" &&
    typeof payload["iat"] === "number" &&
    typeof payload["exp"] === "number"
  );
}

function getAuthTokenSecret(environment: Readonly<Record<string, string | undefined>>): string {
  const secret = environment["AUTH_TOKEN_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_TOKEN_SECRET must be at least 32 characters");
  }
  return secret;
}
