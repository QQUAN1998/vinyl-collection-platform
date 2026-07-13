import { spawn } from "node:child_process";

const DEFAULT_MYSQL_DATABASE = "vinyl_cabinet";

if (!process.env.DATABASE_URL) {
  const address = process.env.MYSQL_ADDRESS?.trim();
  const username = process.env.MYSQL_USERNAME?.trim();
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE?.trim() || DEFAULT_MYSQL_DATABASE;

  if (address && username && password) {
    process.env.DATABASE_URL = `mysql://${encodeURIComponent(username)}:${encodeURIComponent(
      password,
    )}@${address}/${encodeURIComponent(database)}`;
  }
}

await run("npm", ["run", "prisma:deploy", "--workspace", "@vinyl/api"]);
await run("npm", ["run", "start", "--workspace", "@vinyl/api"]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${
            signal ? `signal ${signal}` : `exit code ${code}`
          }`,
        ),
      );
    });
  });
}
