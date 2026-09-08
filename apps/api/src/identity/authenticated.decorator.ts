import { SetMetadata } from "@nestjs/common";
export const AUTHENTICATION_REQUIRED = "authentication-required";
export const Authenticated = () => SetMetadata(AUTHENTICATION_REQUIRED, true);
