import { db } from "@/lib/db";

function usage(): never {
  console.error(`Usage:\n  npm run domain -- create --hostname <host> --name <name>\n  npm run domain -- admin add --domain <host> --email <email>\n  npm run domain -- admin remove --domain <host> --email <email>\n  npm run domain -- admin list --domain <host>`);
  process.exit(2);
}

function arg(args: string[], name: string): string {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) usage();
  return args[index + 1];
}

function hostname(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  const parsed = new URL(`https://${normalized}`);
  if (parsed.hostname !== normalized || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("Invalid hostname");
  return parsed.hostname;
}

async function domainByHost(value: string) {
  const host = hostname(value);
  const domain = await db.domain.findUnique({ where: { hostname: host } });
  if (!domain) throw new Error(`Domain not found: ${host}`);
  return domain;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  if (command === "create") {
    const host = hostname(arg(args, "--hostname"));
    const name = arg(args, "--name");
    const domain = await db.domain.create({ data: { hostname: host, name } });
    console.log(`Created domain ${domain.hostname} (${domain.id})`);
    return;
  }
  if (command === "admin") {
    const action = args[1];
    const domain = await domainByHost(arg(args, "--domain"));
    if (action === "list") {
      const members = await db.domainMembership.findMany({ where: { domainId: domain.id, role: "ADMIN" }, include: { user: { select: { email: true, name: true } } }, orderBy: { createdAt: "asc" } });
      for (const member of members) console.log(`${member.user.email}\t${member.user.name ?? ""}`);
      return;
    }
    const email = arg(args, "--email").trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw new Error(`User not found: ${email}`);
    if (action === "add") {
      await db.domainMembership.upsert({ where: { domainId_userId: { domainId: domain.id, userId: user.id } }, update: { role: "ADMIN" }, create: { domainId: domain.id, userId: user.id, role: "ADMIN" } });
      console.log(`Added ${user.email} as ADMIN to ${domain.hostname}`);
      return;
    }
    if (action === "remove") {
      await db.domainMembership.deleteMany({ where: { domainId: domain.id, userId: user.id } });
      console.log(`Removed ${user.email} from ${domain.hostname}`);
      return;
    }
  }
  usage();
}

main().catch(async error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => db.$disconnect());
