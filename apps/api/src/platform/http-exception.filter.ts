import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { RequestContext } from "./request-context";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const response = host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>();
    const request = host.switchToHttp().getRequest<RequestContext>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail =
      error instanceof HttpException
        ? error.getResponse()
        : "Internal server error";
    if (!(error instanceof HttpException))
      this.logger.error({
        requestId: request.id,
        path: request.originalUrl,
        error,
      });
    response.status(status).json({
      statusCode: status,
      error: detail,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
