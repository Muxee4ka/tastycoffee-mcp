import { describe, expect, it } from "vitest";

import { escapeHtml, EXAMPLE_PROMPTS, renderLandingPage } from "../src/landing.js";
import { CATALOG_FACETS, FACET_NAMES } from "../src/filters.js";
import { describeParameter, TOOL_SPECS } from "../src/tools.js";
import { z } from "zod";

describe("landing page", () => {
  const html = renderLandingPage("https://tastycoffee.example/mcp");

  it("renders every registered tool", () => {
    for (const spec of TOOL_SPECS) {
      expect(html).toContain(spec.name);
      expect(html).toContain(escapeHtml(spec.description));
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

  it("renders every example prompt with its own copy button", () => {
    EXAMPLE_PROMPTS.forEach((example, index) => {
      expect(html).toContain(escapeHtml(example.title));
      expect(html).toContain(escapeHtml(example.prompt));
      expect(html).toContain(`data-copy-target="example-${index}"`);
    });
  });

  it("documents the catalog facets and their values", () => {
    for (const name of FACET_NAMES) {
      const facet = CATALOG_FACETS[name];
      expect(html).toContain(escapeHtml(facet.label));
      for (const value of Object.keys(facet.values)) {
        expect(html).toContain(escapeHtml(value));
      }
    }
    expect(html).toContain("новинки");
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
