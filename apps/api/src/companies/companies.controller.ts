import { Body, Controller, Get, Patch } from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { CompaniesService } from "./companies.service";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Controller("companies/current")
@TenantProtected()
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions("company.read")
  current() {
    return this.companies.current();
  }

  @Patch()
  @RequirePermissions("company.update")
  update(@Body() input: UpdateCompanyDto) {
    return this.companies.update(input);
  }
}
