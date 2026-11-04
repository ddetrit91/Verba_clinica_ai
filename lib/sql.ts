import type { QueryResultRow } from "pg";

export type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: QueryResultRow[] }>;
};

export function toPg(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

export async function queryAll<T extends QueryResultRow>(
  db: Queryable,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db.query(toPg(sql), params);
  return result.rows as T[];
}

export async function queryOne<T extends QueryResultRow>(
  db: Queryable,
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await queryAll<T>(db, sql, params);
  return rows[0];
}
