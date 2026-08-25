import { db } from "@/lib/db";

function getConfiguredHostname(): string {
  const publicUrl = process.env.PUBLIC_URL;
  if (!publicUrl) throw new Error("PUBLIC_URL is required");

  const url = new URL(publicUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PUBLIC_URL must use HTTP or HTTPS");
  }

  return url.hostname.trim().toLowerCase().replace(/\.$/, "");
}

async function main() {
  const hostname = getConfiguredHostname();
  const legacy = await db.domain.findUnique({ where: { id: "legacy-domain" } });

  const domain = legacy
    ? await db.domain.update({
        where: { id: legacy.id },
        data: { hostname, name: hostname, active: true },
      })
    : await db.domain.upsert({
        where: { hostname },
        update: { active: true },
        create: { hostname, name: hostname },
      });

  const users = await db.user.findMany({ select: { id: true, role: true } });
  for (const user of users) {
    await db.domainMembership.upsert({
      where: { domainId_userId: { domainId: domain.id, userId: user.id } },
      update: { role: user.role === "ADMIN" ? "ADMIN" : "USER" },
      create: {
        domainId: domain.id,
        userId: user.id,
        role: user.role === "ADMIN" ? "ADMIN" : "USER",
      },
    });
  }

  console.log(`Bootstrapped domain ${hostname} (${domain.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
