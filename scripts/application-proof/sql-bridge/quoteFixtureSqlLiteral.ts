/** Quote a text literal for the disposable fixture's default PostgreSQL string settings. */
export function quoteFixtureSqlLiteral(value: string) {
  return "'" + value.replaceAll("'", "''") + "'";
}
