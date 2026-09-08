import { Body, Controller, Get, Param, Patch, Post, Query, Delete, ParseUUIDPipe } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { TenantProtected } from '../tenancy/tenant.decorator';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';

@Controller('contacts')
@TenantProtected()
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequirePermissions('contact.read')
  list(@Query() query: ListContactsDto) { return this.contacts.list(query); }

  @Get(':id')
  @RequirePermissions('contact.read')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.contacts.get(id); }

  @Post()
  @RequirePermissions('contact.create')
  create(@Body() input: CreateContactDto) { return this.contacts.create(input); }

  @Post('import')
  @RequirePermissions('contact.create')
  importCsv(@Body() input: ImportContactsDto) { return this.contacts.importCsv(input); }

  @Patch(':id')
  @RequirePermissions('contact.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateContactDto) { return this.contacts.update(id, input); }

  @Delete(':id')
  @RequirePermissions('contact.archive')
  archive(@Param('id', ParseUUIDPipe) id: string) { return this.contacts.archive(id); }
}
