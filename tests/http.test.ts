import { type IncomingMessage } from "node:http";
import { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";

import { resolveEndpointUrl, startHttpServer } from "../src/http.js";
import { TOOL_SPECS } from "../src/tools.js";

let cleanup: (() => Promise<void>) | undefined;

afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

describe("HTTP MCP endpoint", () => {
  it("serves the MCP tools over /mcp with streamable HTTP", async () => {
    const httpServer = await startHttpServer({ port: 0 });
    cleanup = () => httpServer.close();
    const address = httpServer.server.address() as AddressInfo;

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${address.port}/mcp`),
    );
    const client = new Client({ name: "http-test", version: "0.1.0" });
    await client.connect(transport);

    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name)).toContain("recommend_cart");
    await client.close();
  });

  it("exposes exactly the tools the landing page advertises", async () => {
    const httpServer = await startHttpServer({ port: 0 });
    cleanup = () => httpServer.close();
    const address = httpServer.server.address() as AddressInfo;

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${address.port}/mcp`),
    );
    const client = new Client({ name: "http-test", version: "0.1.0" });
    await client.connect(transport);

    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name).sort())
      .toEqual(TOOL_SPECS.map((spec) => spec.name).sort());
    await client.close();
  });

  it("serves an HTML landing page to a browser on GET /mcp", async () => {
    const httpServer = await startHttpServer({ port: 0 });
    cleanup = () => httpServer.close();
    const address = httpServer.server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      headers: { accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("MCP сервер Tasty Coffee");
    expect(body).toContain(`http://127.0.0.1:${address.port}/mcp`);
  });

  it("serves the landing page on GET /", async () => {
    const httpServer = await startHttpServer({ port: 0 });
    cleanup = () => httpServer.close();
    const address = httpServer.server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("MCP сервер Tasty Coffee");
  });

  it("still hands GET /mcp to the MCP transport when the client asks for a stream", async () => {
    const httpServer = await startHttpServer({ port: 0 });
    cleanup = () => httpServer.close();
    const address = httpServer.server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      headers: { accept: "application/json, text/event-stream" },
    });

    expect(response.headers.get("content-type")).not.toContain("text/html");
    await response.body?.cancel();
  });

  it("keeps /healthz as json", async () => {
    const httpServer = await startHttpServer({ port: 0 });
    cleanup = () => httpServer.close();
    const address = httpServer.server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`, {
      headers: { accept: "text/html" },
    });

    expect(await response.json()).toEqual({ ok: true });
  });
});

describe("resolveEndpointUrl", () => {
  it("honours a reverse proxy's forwarded host and protocol", () => {
    const req = {
      headers: { host: "127.0.0.1:3000", "x-forwarded-host": "tastycoffee.muxee4ka.ru", "x-forwarded-proto": "https" },
      socket: {},
    } as unknown as IncomingMessage;

    expect(resolveEndpointUrl(req, "/mcp")).toBe("https://tastycoffee.muxee4ka.ru/mcp");
  });

  it("falls back to the request host over http", () => {
    const req = { headers: { host: "localhost:3000" }, socket: {} } as unknown as IncomingMessage;

    expect(resolveEndpointUrl(req, "/mcp")).toBe("http://localhost:3000/mcp");
  });
});
