import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Counter, Histogram } from "prom-client";
import { Observable, tap } from "rxjs";
import { RequestContext } from "./request-context";

const requests = new Counter({
  name: "http_requests_total",
  help: "HTTP requests",
  labelNames: ["method", "route", "status"],
});
const duration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status"],
});

@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestContext>();
    const response = http.getResponse<{ statusCode: number }>();
    const started = process.hrtime.bigint();
    let errorStatus: number | undefined;
    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          errorStatus =
            error instanceof HttpException ? error.getStatus() : 500;
        },
        finalize: () => {
          const seconds = Number(process.hrtime.bigint() - started) / 1e9;
          const labels = {
            method: request.method,
            route: request.route
              ? `${request.baseUrl}${request.route.path}`
              : "unmatched",
            status: String(errorStatus ?? response.statusCode),
          };
          requests.inc(labels);
          duration.observe(labels, seconds);
          this.logger.log({
            requestId: request.id,
            ...labels,
            durationMs: Math.round(seconds * 1000),
          });
        },
      }),
    );
  }
}
