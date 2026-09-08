import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { TenantContextService } from "../tenancy/tenant-context.service";
import {
  CreateDocumentSequenceDto,
  UpdateDocumentSequenceDto,
} from "./dto/document-sequence.dto";

@Injectable()
export class DocumentSequencesService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const sequences = await this.tenant.db.documentSequence.findMany({
      where: this.scope(),
      orderBy: [{ documentType: "asc" }, { series: "asc" }],
    });
    return sequences.map(presentSequence);
  }

  async create(input: CreateDocumentSequenceDto) {
    try {
      const sequence = await this.tenant.db.documentSequence.create({
        data: {
          ...this.scope(),
          documentType: input.documentType,
          series: input.series.trim().toUpperCase(),
          nextNumber: input.startingNumber,
          padding: input.padding,
        },
      });
      await this.audit.record(
        "document_sequence.created",
        "document_sequence",
        sequence.id,
      );
      return presentSequence(sequence);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Document series already exists");
      throw error;
    }
  }

  async update(id: string, input: UpdateDocumentSequenceDto) {
    const changed = await this.tenant.db.documentSequence.updateMany({
      where: { id, ...this.scope() },
      data: input,
    });
    if (changed.count !== 1)
      throw new NotFoundException("Document sequence not found");
    await this.audit.record(
      "document_sequence.updated",
      "document_sequence",
      id,
      { changedFields: Object.keys(input) },
    );
    const sequence = await this.tenant.db.documentSequence.findFirstOrThrow({
      where: { id, ...this.scope() },
    });
    return presentSequence(sequence);
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new NotFoundException("x-company-id is required");
    return { organizationId, companyId };
  }
}

function presentSequence<T extends { nextNumber: bigint }>(sequence: T) {
  return { ...sequence, nextNumber: sequence.nextNumber.toString() };
}
