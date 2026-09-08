import { SetMetadata } from "@nestjs/common";
import { applyDecorators } from "@nestjs/common";
import { Authenticated } from "../identity/authenticated.decorator";
export const TENANT_PROTECTED = "tenant-protected";
export const TenantProtected = () =>
  applyDecorators(Authenticated(), SetMetadata(TENANT_PROTECTED, true));
