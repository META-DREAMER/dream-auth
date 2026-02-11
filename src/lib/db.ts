import { Pool } from "pg";
import { serverEnv } from "@/env";

/**
 * Shared PostgreSQL connection pool singleton.
 * Reuse this instead of creating new Pool() instances per request.
 */
export const pool = new Pool({
	connectionString: serverEnv.DATABASE_URL,
});
