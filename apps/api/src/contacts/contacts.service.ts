import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';
import { parseContactCsv } from './csv';
import { CreateContactAddressDto } from './dto/create-contact-address.dto';
import { UpdateContactAddressDto } from './dto/update-contact-address.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService, private readonly audit: AuditService) {}

  async list(query: ListContactsDto) {
    const scope = this.scope();
    if (query.cursor) await this.assertCursorInScope(query.cursor);
    const search = query.search?.trim();
    const contacts = await this.prisma.contact.findMany({
      where: { ...scope, status: ContactStatus.ACTIVE, ...(search ? { OR: [{ legalName: { contains: search, mode: 'insensitive' } }, { tradeName: { contains: search, mode: 'insensitive' } }, { taxId: { contains: search, mode: 'insensitive' } }] } : {}) },
      orderBy: [{ legalName: 'asc' }, { id: 'asc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = contacts.length > query.limit;
    const data = hasMore ? contacts.slice(0, -1) : contacts;
    return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
  }

  async get(id: string) { return this.findActive(id); }

  async create(input: CreateContactDto) {
    if (!input.isCustomer && !input.isSupplier) throw new BadRequestException('A contact must be a customer, a supplier, or both');
    const contact = await this.prisma.contact.create({
      data: {
        ...this.scope(),
        legalName: input.legalName.trim(),
        tradeName: input.tradeName?.trim() || null,
        taxId: input.taxId?.trim().toUpperCase() || null,
        email: input.email?.trim().toLowerCase() || null,
        phone: input.phone?.trim() || null,
        isCustomer: input.isCustomer,
        isSupplier: input.isSupplier,
      },
    });
    await this.audit.record('contact.created', 'contact', contact.id, { isCustomer: contact.isCustomer, isSupplier: contact.isSupplier });
    return contact;
  }

  async importCsv(input: ImportContactsDto) {
    const rows = parseContactCsv(input.csv);
    if (rows.length > 1_000) throw new BadRequestException('A contact import cannot contain more than 1,000 rows');
    const scope = this.scope();
    const taxIds = rows.flatMap(({ taxId }) => taxId ? [taxId] : []);
    if (taxIds.length) {
      const existing = await this.prisma.contact.findFirst({ where: { ...scope, taxId: { in: taxIds } }, select: { taxId: true } });
      if (existing?.taxId) throw new ConflictException(`A contact with tax ID ${existing.taxId} already exists`);
    }
    const contacts = await this.prisma.$transaction((tx) => Promise.all(rows.map((row) => tx.contact.create({ data: { ...scope, legalName: row.legalName, tradeName: row.tradeName, taxId: row.taxId, email: row.email, phone: row.phone, isCustomer: row.isCustomer, isSupplier: row.isSupplier } }))));
    await this.audit.record('contact.imported', 'contact_import', undefined, { count: contacts.length });
    return { imported: contacts.length, contacts };
  }

  async update(id: string, input: UpdateContactDto) {
    const contact = await this.findActive(id);
    const next = { ...contact, ...normalize(input) };
    if (!next.isCustomer && !next.isSupplier) throw new BadRequestException('A contact must be a customer, a supplier, or both');
    try {
      const updated = await this.prisma.contact.update({ where: { id: contact.id }, data: normalize(input) });
      await this.audit.record('contact.updated', 'contact', contact.id, { changedFields: Object.keys(input) });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A contact with this tax ID already exists');
      throw error;
    }
  }

  async archive(id: string) {
    const contact = await this.findActive(id);
    const archived = await this.prisma.contact.update({ where: { id: contact.id }, data: { status: ContactStatus.ARCHIVED } });
    await this.audit.record('contact.archived', 'contact', contact.id);
    return archived;
  }

  async listAddresses(contactId: string) {
    await this.findActive(contactId);
    return this.prisma.contactAddress.findMany({ where: { contactId, ...this.scope(), archivedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  }

  async addAddress(contactId: string, input: CreateContactAddressDto) {
    await this.findActive(contactId);
    const scope = this.scope();
    const address = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.contactAddress.updateMany({ where: { contactId, ...scope, archivedAt: null }, data: { isDefault: false } });
      return tx.contactAddress.create({
        data: {
          contactId,
          ...scope,
          type: input.type,
          label: input.label?.trim() || null,
          line1: input.line1.trim(),
          line2: input.line2?.trim() || null,
          postalCode: input.postalCode.trim().toUpperCase(),
          city: input.city.trim(),
          province: input.province?.trim() || null,
          country: input.country?.toUpperCase() ?? 'ES',
          isDefault: input.isDefault ?? false,
        },
      });
    });
    await this.audit.record('contact.address_created', 'contact_address', address.id, { contactId });
    return address;
  }

  async updateAddress(contactId: string, addressId: string, input: UpdateContactAddressDto) {
    await this.findActive(contactId);
    const scope = this.scope();
    const existing = await this.prisma.contactAddress.findFirst({ where: { id: addressId, contactId, ...scope, archivedAt: null } });
    if (!existing) throw new NotFoundException('Contact address not found');
    const address = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.contactAddress.updateMany({ where: { contactId, ...scope, archivedAt: null, id: { not: addressId } }, data: { isDefault: false } });
      return tx.contactAddress.update({ where: { id: addressId }, data: normaliseAddress(input) });
    });
    await this.audit.record('contact.address_updated', 'contact_address', address.id, { contactId, changedFields: Object.keys(input) });
    return address;
  }

  async archiveAddress(contactId: string, addressId: string) {
    await this.findActive(contactId);
    const address = await this.prisma.contactAddress.findFirst({ where: { id: addressId, contactId, ...this.scope(), archivedAt: null } });
    if (!address) throw new NotFoundException('Contact address not found');
    const archived = await this.prisma.contactAddress.update({ where: { id: address.id }, data: { archivedAt: new Date(), isDefault: false } });
    await this.audit.record('contact.address_archived', 'contact_address', address.id, { contactId });
    return archived;
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException('x-company-id is required');
    return { organizationId, companyId };
  }

  private async findActive(id: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, ...this.scope(), status: ContactStatus.ACTIVE } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  private async assertCursorInScope(id: string) {
    const cursor = await this.prisma.contact.findFirst({ where: { id, ...this.scope(), status: ContactStatus.ACTIVE }, select: { id: true } });
    if (!cursor) throw new BadRequestException('Cursor does not belong to the selected company');
  }
}

function normalize(input: CreateContactDto | UpdateContactDto) {
  return {
    ...input,
    ...(input.legalName !== undefined ? { legalName: input.legalName.trim() } : {}),
    ...(input.tradeName !== undefined ? { tradeName: input.tradeName.trim() || null } : {}),
    ...(input.taxId !== undefined ? { taxId: input.taxId.trim().toUpperCase() || null } : {}),
    ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
  };
}

function normaliseAddress(input: CreateContactAddressDto | UpdateContactAddressDto) {
  return {
    ...input,
    ...(input.label !== undefined ? { label: input.label.trim() || null } : {}),
    ...(input.line1 !== undefined ? { line1: input.line1.trim() } : {}),
    ...(input.line2 !== undefined ? { line2: input.line2.trim() || null } : {}),
    ...(input.postalCode !== undefined ? { postalCode: input.postalCode.trim().toUpperCase() } : {}),
    ...(input.city !== undefined ? { city: input.city.trim() } : {}),
    ...(input.province !== undefined ? { province: input.province.trim() || null } : {}),
    ...(input.country !== undefined ? { country: input.country.toUpperCase() } : {}),
  };
}
