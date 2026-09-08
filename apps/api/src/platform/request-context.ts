export interface RequestContext {
  id?: string;
  method: string;
  originalUrl: string;
  baseUrl: string;
  route?: { path: string };
}
