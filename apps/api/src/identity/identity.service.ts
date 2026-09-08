import * as argon2 from "argon2";
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { MembershipStatus, SessionStatus, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { TokenPair, TokenService } from "./token.service";

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterDto): Promise<TokenPair> {
    const email = input.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException("An account already exists for this email");

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const user = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { code: "organization.owner" },
        update: {},
        create: { code: "organization.owner", name: "Organization owner" },
      });
      const permissions = await Promise.all(
        [
          ["company.read", "Read company configuration"],
          ["company.update", "Update company configuration"],
          ["company.manage", "Manage companies"],
          ["contact.read", "Read contacts"],
          ["contact.create", "Create contacts"],
          ["contact.update", "Update contacts"],
          ["contact.archive", "Archive contacts"],
          ["catalog.read", "Read catalog"],
          ["catalog.create", "Create catalog items"],
          ["catalog.update", "Update catalog items"],
          ["catalog.archive", "Archive catalog items"],
          ["quote.read", "Read quotations"],
          ["quote.create", "Create quotations"],
          ["quote.update", "Update quotations"],
          ["quote.change_status", "Change quotation status"],
          ["document_sequence.read", "Read document sequences"],
          ["document_sequence.manage", "Manage document sequences"],
          ["invoice.read", "Read invoices"],
          ["invoice.create", "Create invoice drafts"],
          ["invoice.update", "Update invoice drafts"],
          ["invoice.delete", "Delete invoice drafts"],
          ["invoice.issue", "Issue invoices"],
          ["invoice.send", "Send invoices"],
          ["payment.read", "Read invoice payments"],
          ["payment.create", "Record invoice payments"],
          ["tax_rule.read", "Read versioned tax rules"],
          ["tax_ledger.read", "Read tax ledger"],
        ].map(([code, name]) =>
          tx.permission.upsert({
            where: { code },
            update: {},
            create: { code, name },
          }),
        ),
      );
      await Promise.all(
        permissions.map(({ id: permissionId }) =>
          tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId } },
            update: {},
            create: { roleId: role.id, permissionId },
          }),
        ),
      );
      const organization = await tx.organization.create({
        data: { name: input.organizationName.trim() },
      });
      await tx.$queryRaw`SELECT set_config('app.organization_id', ${organization.id}, true)`;
      const company = await tx.company.create({
        data: {
          organizationId: organization.id,
          legalName: input.legalName.trim(),
          taxId: input.taxId.trim().toUpperCase(),
        },
      });
      const createdUser = await tx.user.create({
        data: { email, passwordHash, status: UserStatus.ACTIVE },
      });
      await tx.membership.create({
        data: {
          organizationId: organization.id,
          companyId: company.id,
          userId: createdUser.id,
          roleId: role.id,
          status: MembershipStatus.ACTIVE,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: organization.id,
          companyId: company.id,
          actorUserId: createdUser.id,
          action: "organization.registered",
          entityType: "organization",
          entityId: organization.id,
          metadata: { companyId: company.id },
        },
      });
      return createdUser;
    });
    return this.createSession(user.id);
  }

  async login(input: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (
      !user?.passwordHash ||
      user.status !== UserStatus.ACTIVE ||
      !(await argon2.verify(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.createSession(user.id);
  }

  async rotate(refreshToken: string): Promise<TokenPair> {
    const claims = await this.tokens.verifyRefresh(refreshToken);
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: {
          id: claims.sessionId,
          userId: claims.userId,
          tokenVersion: claims.version,
          status: SessionStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
      });
      if (!session || !(await safeVerify(session.refreshHash, refreshToken)))
        throw new UnauthorizedException("Refresh token is no longer valid");
      const nextVersion = session.tokenVersion + 1;
      const next = await this.tokens.issue(
        session.userId,
        session.id,
        nextVersion,
      );
      const refreshHash = await argon2.hash(next.refreshToken, {
        type: argon2.argon2id,
      });
      const changed = await tx.session.updateMany({
        where: {
          id: session.id,
          status: SessionStatus.ACTIVE,
          tokenVersion: session.tokenVersion,
          refreshHash: session.refreshHash,
        },
        data: {
          refreshHash,
          tokenVersion: nextVersion,
          lastUsedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        throw new UnauthorizedException("Refresh token was already used");
      return next;
    });
  }

  async sessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoke(userId: string, sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
    });
  }

  private async createSession(userId: string): Promise<TokenPair> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          userId,
          refreshHash: "pending",
          expiresAt: this.tokens.refreshExpiresAt(),
        },
      });
      const tokens = await this.tokens.issue(userId, session.id, 0);
      await tx.session.update({
        where: { id: session.id },
        data: {
          refreshHash: await argon2.hash(tokens.refreshToken, {
            type: argon2.argon2id,
          }),
        },
      });
      return tokens;
    });
  }
}

async function safeVerify(hash: string, value: string) {
  try {
    return await argon2.verify(hash, value);
  } catch {
    return false;
  }
}
