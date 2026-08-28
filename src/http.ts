import { createServer as createNodeServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createServer as createMcpServer } from "./server.js";

export type HttpServerOptions = {
  host?: string;
  port?: number;
  path?: string;
};

export type RunningHttpServer = {
  server: ReturnType<typeof createNodeServer>;
  close: () => Promise<void>;
};

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const mcpServer = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    void mcpServer.close();
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);
}

export async function startHttpServer(options: HttpServerOptions = {}): Promise<RunningHttpServer> {
  const host = options.host ?? process.env.HOST;
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  const path = options.path ?? "/mcp";

  const server = createNodeServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname !== path) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    void handleMcpRequest(req, res).catch((error: unknown) => {
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : "internal_error",
        });
      } else {
        res.destroy(error instanceof Error ? error : undefined);
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });

  return {
    server,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
  };
}

async function main(): Promise<void> {
  const running = await startHttpServer();
  const address = running.server.address();
  const displayAddress = typeof address === "object" && address
    ? `${address.address === "::" ? "0.0.0.0" : address.address}:${address.port}`
    : String(address);
  console.error(`Tasty Coffee MCP HTTP server listening on ${displayAddress}/mcp`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
