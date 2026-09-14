import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const [emailArgument, baseUrlArgument] = process.argv.slice(2);
const email = emailArgument?.trim().toLowerCase();
const baseUrl = baseUrlArgument ?? process.env.APP_BASE_URL;

if (!email || !baseUrl) {
  console.error(
    "Usage: npm run password:recovery-link -- user@example.com https://ledger.example.com",
  );
  process.exit(1);
}

let recoveryUrl;
try {
  recoveryUrl = new URL("/recuperar", baseUrl);
  if (!["http:", "https:"].includes(recoveryUrl.protocol)) throw new Error();
} catch {
  console.error("The application base URL must be a valid HTTP or HTTPS URL.");
  process.exit(1);
}

const ttlMinutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30);
if (!Number.isInteger(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 1440) {
  console.error(
    "PASSWORD_RESET_TTL_MINUTES must be an integer from 5 to 1440.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    console.error(`No account exists for ${email}.`);
    process.exitCode = 2;
  } else {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);
    recoveryUrl.searchParams.set("token", token);
    console.log(`Recovery link (expires in ${ttlMinutes} minutes):`);
    console.log(recoveryUrl.toString());
  }
} finally {
  await prisma.$disconnect();
}
