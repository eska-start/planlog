import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

const sql = readFileSync("./drizzle/0001_charming_zombie.sql", "utf-8");
const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

const conn = await mysql.createConnection(process.env.DATABASE_URL);

for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log("✓", stmt.slice(0, 60).replace(/\n/g, " "));
  } catch (e) {
    if (e.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("skip (exists):", stmt.slice(0, 60).replace(/\n/g, " "));
    } else {
      console.error("✗", e.message);
    }
  }
}

await conn.end();
console.log("Migration complete.");
