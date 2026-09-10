import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    await this.prisma.$queryRaw`SELECT id FROM "users" LIMIT 1`;
    return { status: "ready" };
  }
}
