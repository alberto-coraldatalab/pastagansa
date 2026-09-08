import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogItemStatus, CatalogItemType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { ListCatalogItemsDto } from './dto/list-catalog-items.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { ImportCatalogItemsDto } from './dto/import-catalog-items.dto';
import { parseCatalogCsv } from './csv';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService, private readonly audit: AuditService) {}

  async list(query: ListCatalogItemsDto) {
    if (query.cursor) await this.assertCursorInScope(query.cursor);
    const search = query.search?.trim();
    const items = await this.prisma.catalogItem.findMany({
      where: { ...this.scope(), status: CatalogItemStatus.ACTIVE, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] } : {}) },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = items.length > query.limit;
    const data = hasMore ? items.slice(0, -1) : items;
    return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
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

  async importCsv(input: ImportCatalogItemsDto) {
    const rows = parseCatalogCsv(input.csv);
    if (rows.length > 1_000) throw new BadRequestException('A catalog import cannot contain more than 1,000 rows');
    const scope = this.scope();
    const skus = rows.flatMap(({ sku }) => sku ? [sku] : []);
    if (skus.length) {
      const existing = await this.prisma.catalogItem.findFirst({ where: { ...scope, sku: { in: skus } }, select: { sku: true } });
      if (existing?.sku) throw new ConflictException(`A catalog item with SKU ${existing.sku} already exists`);
    }
    try {
      const items = await this.prisma.$transaction((tx) => Promise.all(rows.map((row) => tx.catalogItem.create({ data: { ...scope, type: row.type, sku: row.sku, name: row.name, description: row.description, unit: row.unit, salesPrice: row.salesPrice, currency: row.currency, suggestedTaxCode: row.suggestedTaxCode, revenueAccountCode: row.revenueAccountCode, expenseAccountCode: row.expenseAccountCode, trackInventory: row.trackInventory } }))));
      await this.audit.record('catalog_item.imported', 'catalog_import', undefined, { count: items.length });
      return { imported: items.length, items };
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

  private async assertCursorInScope(id: string) {
    const cursor = await this.prisma.catalogItem.findFirst({ where: { id, ...this.scope(), status: CatalogItemStatus.ACTIVE }, select: { id: true } });
    if (!cursor) throw new BadRequestException('Cursor does not belong to the selected company');
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
