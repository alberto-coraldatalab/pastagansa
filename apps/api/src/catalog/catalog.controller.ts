import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { TenantProtected } from '../tenancy/tenant.decorator';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { ListCatalogItemsDto } from './dto/list-catalog-items.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { ImportCatalogItemsDto } from './dto/import-catalog-items.dto';

@Controller('catalog-items')
@TenantProtected()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get() @RequirePermissions('catalog.read') list(@Query() query: ListCatalogItemsDto) { return this.catalog.list(query); }
  @Get(':id') @RequirePermissions('catalog.read') get(@Param('id', ParseUUIDPipe) id: string) { return this.catalog.get(id); }
  @Post() @RequirePermissions('catalog.create') create(@Body() input: CreateCatalogItemDto) { return this.catalog.create(input); }
  @Post('import') @RequirePermissions('catalog.create') importCsv(@Body() input: ImportCatalogItemsDto) { return this.catalog.importCsv(input); }
  @Patch(':id') @RequirePermissions('catalog.update') update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateCatalogItemDto) { return this.catalog.update(id, input); }
  @Delete(':id') @RequirePermissions('catalog.archive') archive(@Param('id', ParseUUIDPipe) id: string) { return this.catalog.archive(id); }
}
