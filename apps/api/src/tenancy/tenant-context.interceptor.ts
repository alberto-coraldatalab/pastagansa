import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { from, lastValueFrom, Observable } from "rxjs";
import { PrismaService } from "../prisma.service";
import { TenantContextService } from "./tenant-context.service";
import { AuthenticatedRequest } from "./tenant.types";

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tenant) return next.handle();
    return from(
      this.prisma.$transaction(
        async (db) => {
          await db.$queryRaw`SELECT set_config('app.organization_id', ${request.tenant!.organizationId}, true)`;
          return this.tenantContext.run({ ...request.tenant!, db }, () =>
            lastValueFrom(next.handle()),
          );
        },
        { maxWait: 5_000, timeout: 15_000 },
      ),
    );
  }
}
