import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { DocumentSequencesService } from "./document-sequences.service";
import {
  CreateDocumentSequenceDto,
  UpdateDocumentSequenceDto,
} from "./dto/document-sequence.dto";

@Controller("document-sequences")
@TenantProtected()
export class DocumentSequencesController {
  constructor(private readonly sequences: DocumentSequencesService) {}

  @Get()
  @RequirePermissions("document_sequence.read")
  list() {
    return this.sequences.list();
  }

  @Post()
  @RequirePermissions("document_sequence.manage")
  create(@Body() input: CreateDocumentSequenceDto) {
    return this.sequences.create(input);
  }

  @Patch(":id")
  @RequirePermissions("document_sequence.manage")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateDocumentSequenceDto,
  ) {
    return this.sequences.update(id, input);
  }
}
