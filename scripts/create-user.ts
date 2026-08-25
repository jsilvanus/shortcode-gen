import argon2 from "argon2";
import { db } from "@/lib/db";

const [, , username, password, role = "USER"] = process.argv;

if (!username || !password || !["USER", "ADMIN"].includes(role)) {
  console.error("Usage: npm run create-user -- <username> <password> [USER|ADMIN]");
  process.exit(1);
}

const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
const user = await db.user.create({ data: { username, passwordHash, role } });
console.log(`Created ${user.role} user: ${user.username}`);
await db.$disconnect();
