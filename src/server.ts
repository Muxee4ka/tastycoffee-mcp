import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TastyCoffeeClient } from "./tastycoffee-client.js";
import { TOOL_SPECS } from "./tools.js";

export const SERVER_NAME = "tastycoffee-mcp";
export const SERVER_VERSION = "0.1.0";

const client = new TastyCoffeeClient();

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  for (const spec of TOOL_SPECS) {
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: spec.inputSchema,
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      async (args: unknown) => jsonResult(await spec.handler(client, args as never)),
    );
  }

  server.registerResource(
    "settings",
    "tastycoffee://settings",
    {
      title: "Tasty Coffee settings",
      description: "Public Tasty Coffee shop settings.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await client.getSettings(), null, 2),
        },
      ],
    }),
  );

  return server;
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
