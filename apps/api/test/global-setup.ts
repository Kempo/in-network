import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

config({ path: "../../.env" });

export default async function setup() {
  const base = process.env.DATABASE_URL!; // .../in_network
  const admin = base.replace(/\/[^/?]+(\?|$)/, "/postgres$1"); // connect to default db to run CREATE
  const testUrl = base.replace(/\/[^/?]+(\?|$)/, "/in_network_test$1");

  const adminPool = new Pool({ connectionString: admin });
  await adminPool.query(`DROP DATABASE IF EXISTS in_network_test`);
  await adminPool.query(`CREATE DATABASE in_network_test`);
  await adminPool.end();

  // Migrate once here so the workers' per-file runMigrations() calls are no-ops
  // (concurrent drizzle migrations on a fresh DB race on pg_type creation).
  const testPool = new Pool({ connectionString: testUrl });
  await migrate(drizzle(testPool), { migrationsFolder: "./src/db/migrations" });
  await testPool.end();
}
