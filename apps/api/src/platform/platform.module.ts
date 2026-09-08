import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { MetricsController } from "./metrics.controller";
import { HttpObservabilityInterceptor } from "./http-observability.interceptor";
@Module({
  controllers: [MetricsController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: HttpObservabilityInterceptor },
  ],
})
export class PlatformModule {}
