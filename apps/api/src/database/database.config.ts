const DEFAULT_WECHAT_MYSQL_DATABASE = "vinyl_cabinet";

export function getDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const value =
    environment["DATABASE_URL"] ?? getWechatCloudHostingDatabaseUrl(environment);

  if (!value) {
    throw new Error("DATABASE_URL is required");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid URL");
  }

  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use a MySQL protocol");
  }

  return value;
}

function getWechatCloudHostingDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const address = environment["MYSQL_ADDRESS"]?.trim();
  const username = environment["MYSQL_USERNAME"]?.trim();
  const password = environment["MYSQL_PASSWORD"];

  if (!address || !username || !password) {
    return undefined;
  }

  const database =
    environment["MYSQL_DATABASE"]?.trim() || DEFAULT_WECHAT_MYSQL_DATABASE;

  return `mysql://${encodeURIComponent(username)}:${encodeURIComponent(
    password,
  )}@${address}/${encodeURIComponent(database)}`;
}
