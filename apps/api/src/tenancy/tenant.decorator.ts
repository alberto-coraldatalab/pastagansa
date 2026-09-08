import { SetMetadata } from '@nestjs/common';
export const TENANT_PROTECTED = 'tenant-protected';
export const TenantProtected = () => SetMetadata(TENANT_PROTECTED, true);
