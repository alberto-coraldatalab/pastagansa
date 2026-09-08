import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogItemStatus, CatalogItemType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { ListCatalogItemsDto } from './dto/list-catalog-items.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService, private readonly audit: AuditService) {}

  async list(query: ListCatalogItemsDto) {
    const search = query.search?.trim();
    return this.prisma.catalogItem.findMany({
      where: { ...this.scope(), status: CatalogItemStatus.ACTIVE, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] } : {}) },
      orderBy: { name: 'asc' }, take: query.limit,
    });
  }

  async get(id: string) { return this.findActive(id); }

  async create(input: CreateCatalogItemDto) {
    this.validateInventory(input.type, input.trackInventory ?? false);
    try {
      const item = await this.prisma.catalogItem.create({ data: { ...this.scope(), ...normaliseCreate(input) } });
      await this.audit.record('catalog_item.created', 'catalog_item', item.id, { type: item.type });
      return item;
    } catch (error) { throwConflict(error); }
  }

  async update(id: string, input: UpdateCatalogItemDto) {
    const item = await this.findActive(id);
    this.validateInventory(input.type ?? item.type, input.trackInventory ?? item.trackInventory);
    try {
      const updated = await this.prisma.catalogItem.update({ where: { id: item.id }, data: normaliseUpdate(input) });
      await this.audit.record('catalog_item.updated', 'catalog_item', item.id, { changedFields: Object.keys(input) });
      return updated;
    } catch (error) { throwConflict(error); }
  }

  async archive(id: string) {
    const item = await this.findActive(id);
    const archived = await this.prisma.catalogItem.update({ where: { id: item.id }, data: { status: CatalogItemStatus.ARCHIVED } });
    await this.audit.record('catalog_item.archived', 'catalog_item', item.id);
    return archived;
  }

  private validateInventory(type: CatalogItemType, trackInventory: boolean) {
    if (type === CatalogItemType.SERVICE && trackInventory) throw new BadRequestException('Services cannot track inventory');
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException('x-company-id is required');
    return { organizationId, companyId };
  }

  private async findActive(id: string) {
    const item = await this.prisma.catalogItem.findFirst({ where: { id, ...this.scope(), status: CatalogItemStatus.ACTIVE } });
    if (!item) throw new NotFoundException('Catalog item not found');
    return item;
  }
}

function normaliseCreate(input: CreateCatalogItemDto) {
  return { type: input.type, sku: blankToNull(input.sku), name: input.name.trim(), description: blankToNull(input.description), unit: input.unit?.trim() || 'unit', salesPrice: input.salesPrice, currency: input.currency ?? 'EUR', suggestedTaxCode: blankToNull(input.suggestedTaxCode), revenueAccountCode: blankToNull(input.revenueAccountCode), expenseAccountCode: blankToNull(input.expenseAccountCode), trackInventory: input.trackInventory ?? false };
}
function normaliseUpdate(input: UpdateCatalogItemDto) {
  return { ...input, ...(input.sku !== undefined ? { sku: blankToNull(input.sku) } : {}), ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.description !== undefined ? { description: blankToNull(input.description) } : {}), ...(input.unit !== undefined ? { unit: input.unit.trim() || 'unit' } : {}), ...(input.suggestedTaxCode !== undefined ? { suggestedTaxCode: blankToNull(input.suggestedTaxCode) } : {}), ...(input.revenueAccountCode !== undefined ? { revenueAccountCode: blankToNull(input.revenueAccountCode) } : {}), ...(input.expenseAccountCode !== undefined ? { expenseAccountCode: blankToNull(input.expenseAccountCode) } : {}) };
}
function blankToNull(value?: string) { return value?.trim() || null; }
function throwConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A catalog item with this SKU already exists');
  throw error;
}
