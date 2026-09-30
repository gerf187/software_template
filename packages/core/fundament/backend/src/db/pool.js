import pg from "pg";

const connectionString =
  process.env.TENANT_DATABASE_URL || "postgres://app:app@localhost:5432/saas";

export const pool = new pg.Pool({ connectionString });
