import { createServer } from "node:http";

import { routeRequest } from "./router.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const result = routeRequest(request.method ?? "GET", url.pathname);

  response.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(result.body));
});

server.listen(port, () => {
  console.log(`Vinyl API listening on http://127.0.0.1:${port}`);
});
