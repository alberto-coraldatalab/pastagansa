export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string };
  tenant?: { organizationId: string; companyId?: string; userId: string; roleCodes: string[] };
}
