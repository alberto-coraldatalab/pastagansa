import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  organizationId: string;
  companyId?: string;
  userId: string;
  roleCodes: string[];
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get required(): TenantContext {
    const context = this.storage.getStore();
    if (!context) throw new Error('Tenant context is required for this operation');
    return context;
  }
}
