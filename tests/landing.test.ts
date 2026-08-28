import { describe, expect, it } from "vitest";

import { renderLandingPage } from "../src/landing.js";
import { describeParameter, TOOL_SPECS } from "../src/tools.js";
import { z } from "zod";

describe("landing page", () => {
  const html = renderLandingPage("https://tastycoffee.example/mcp");

  it("renders every registered tool", () => {
    for (const spec of TOOL_SPECS) {
      expect(html).toContain(spec.name);
      expect(html).toContain(spec.description.replace(/&/g, "&amp;"));
    }
  });

  it("shows the endpoint url and a copyable sample prompt", () => {
    expect(html).toContain("https://tastycoffee.example/mcp");
    expect(html).toContain('data-copy-target="ai-prompt-text"');
    expect(html).toContain("claude mcp add --transport http tastycoffee");
  });

  it("marks cart tools as writing tools", () => {
    const cartSection = html.slice(html.indexOf("create_cart_share_link"));
    expect(cartSection).toContain("изменяет данные");
  });

  it("escapes html so a tool description cannot inject markup", () => {
    expect(html).not.toContain("<script>alert");
    expect(html.match(/<title>/g)).toHaveLength(1);
  });
});

describe("describeParameter", () => {
  it("reports required scalars", () => {
    expect(describeParameter("query", z.string().min(1))).toEqual({
      name: "query",
      type: "string",
      required: true,
    });
  });

  it("unwraps defaults and reports them", () => {
    expect(describeParameter("page", z.number().int().positive().default(1))).toEqual({
      name: "page",
      type: "number",
      required: false,
      defaultValue: "1",
    });
  });

  it("unwraps optionals and arrays", () => {
    expect(describeParameter("ids", z.array(z.number()).optional())).toEqual({
      name: "ids",
      type: "number[]",
      required: false,
    });
  });

  it("keeps the zod description as a hint", () => {
    expect(describeParameter("slug", z.string().describe("Product slug."))).toMatchObject({
      description: "Product slug.",
    });
  });
});
