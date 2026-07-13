import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from "@nestjs/common";
import { createApiError, type ApiErrorCode } from "@vinyl/shared";

interface HttpResponse {
  status(statusCode: number): { json(body: object): void };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const code = getErrorCode(status);
    const message = getSafeMessage(status);

    response.status(status).json(createApiError(code, message));
  }
}

function getErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "VALIDATION_ERROR";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHENTICATED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    default:
      return "INTERNAL_ERROR";
  }
}

function getSafeMessage(status: number): string {
  switch (status) {
    case HttpStatus.NOT_FOUND:
      return "Route not found";
    case HttpStatus.UNAUTHORIZED:
      return "Authentication required";
    case HttpStatus.FORBIDDEN:
      return "Access denied";
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "Invalid request";
    case HttpStatus.CONFLICT:
      return "Request conflict";
    default:
      return "Internal server error";
  }
}
