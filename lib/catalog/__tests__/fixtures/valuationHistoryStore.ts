import type { TablesInsert } from "@/types/database.types";

/** Synthetic provider-boundary store; never connects to a database. */
export function valuationHistoryStore() {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    from: (table: string) => {
      if (table !== "catalog_valuations") throw new Error("Unexpected table access");
      let inserted: Record<string, unknown> | undefined;
      let catalogId: string | undefined;
      const orders: Array<{ column: string; ascending: boolean }> = [];
      const query = {
        insert: (input: TablesInsert<"catalog_valuations">) => {
          inserted = {
            ...input,
            id: `fixture_${rows.length}`,
            measured_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };
          rows.push(inserted);
          return query;
        },
        select: () => query,
        single: async () => ({ data: inserted, error: null }),
        eq: (column: string, value: string) => {
          if (column !== "catalog_id") throw new Error("Unscoped history query");
          catalogId = value;
          return query;
        },
        order: (column: string, options: { ascending: boolean }) => {
          orders.push({ column, ascending: options.ascending });
          return query;
        },
        limit: async (limit: number) => {
          if (!catalogId) throw new Error("Missing catalog scope");
          const data = rows
            .filter(row => row.catalog_id === catalogId)
            .sort((a, b) => {
              for (const { column, ascending } of orders) {
                const compared = String(a[column]).localeCompare(String(b[column]));
                if (compared) return ascending ? compared : -compared;
              }
              return 0;
            })
            .slice(0, limit);
          return { data, error: null };
        },
      };
      return query;
    },
  };
}
