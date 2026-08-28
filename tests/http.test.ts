import { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";

import { startHttpServer } from "../src/http.js";

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
});
