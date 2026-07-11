export function getDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const value = environment["DATABASE_URL"];

  if (!value) {
    throw new Error("DATABASE_URL is required");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid URL");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use a PostgreSQL protocol");
  }

  return value;
}
