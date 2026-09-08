import { Body, Controller, Get, Param, Patch, Post, Query, Delete, ParseUUIDPipe } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { TenantProtected } from '../tenancy/tenant.decorator';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';
import { CreateContactAddressDto } from './dto/create-contact-address.dto';
import { UpdateContactAddressDto } from './dto/update-contact-address.dto';

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

  @Get(':id/addresses')
  @RequirePermissions('contact.read')
  listAddresses(@Param('id', ParseUUIDPipe) id: string) { return this.contacts.listAddresses(id); }

  @Post(':id/addresses')
  @RequirePermissions('contact.update')
  addAddress(@Param('id', ParseUUIDPipe) id: string, @Body() input: CreateContactAddressDto) { return this.contacts.addAddress(id, input); }

  @Patch(':id/addresses/:addressId')
  @RequirePermissions('contact.update')
  updateAddress(@Param('id', ParseUUIDPipe) id: string, @Param('addressId', ParseUUIDPipe) addressId: string, @Body() input: UpdateContactAddressDto) { return this.contacts.updateAddress(id, addressId, input); }

  @Delete(':id/addresses/:addressId')
  @RequirePermissions('contact.archive')
  archiveAddress(@Param('id', ParseUUIDPipe) id: string, @Param('addressId', ParseUUIDPipe) addressId: string) { return this.contacts.archiveAddress(id, addressId); }

  @Patch(':id')
  @RequirePermissions('contact.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateContactDto) { return this.contacts.update(id, input); }

  @Delete(':id')
  @RequirePermissions('contact.archive')
  archive(@Param('id', ParseUUIDPipe) id: string) { return this.contacts.archive(id); }
}
