import { createServer as createNodeServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { renderLandingPage } from "./landing.js";
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

function sendHtml(res: ServerResponse, statusCode: number, body: string): void {
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=300",
  });
  res.end(body);
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw.split(",")[0]!.trim() : undefined;
}

/**
 * Public URL of the MCP endpoint as the visitor reached it, so the page shows a
 * link that actually works from behind a reverse proxy.
 */
export function resolveEndpointUrl(req: IncomingMessage, path: string): string {
  if (process.env.PUBLIC_URL) {
    return new URL(path, process.env.PUBLIC_URL).href;
  }
  const host = firstHeader(req.headers["x-forwarded-host"]) ?? req.headers.host ?? "localhost";
  const proto = firstHeader(req.headers["x-forwarded-proto"])
    ?? ((req.socket as { encrypted?: boolean }).encrypted ? "https" : "http");
  return new URL(path, `${proto}://${host}`).href;
}

/**
 * A streamable-HTTP client always asks for text/event-stream on GET, so anything
 * else on a GET is a human in a browser (or curl) and gets the landing page
 * instead of a 406 from the MCP transport.
 */
export function wantsLandingPage(req: IncomingMessage): boolean {
  if (req.method !== "GET") {
    return false;
  }
  const accept = (req.headers.accept ?? "").toLowerCase();
  return !accept.includes("text/event-stream");
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

    if (url.pathname === "/" && req.method === "GET") {
      sendHtml(res, 200, renderLandingPage(resolveEndpointUrl(req, path)));
      return;
    }

    if (url.pathname !== path) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    if (wantsLandingPage(req)) {
      sendHtml(res, 200, renderLandingPage(resolveEndpointUrl(req, path)));
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
