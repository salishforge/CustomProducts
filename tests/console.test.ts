import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  consoleCeilingCents,
  consoleCostCents,
  consoleEnabled,
  isConsoleConfigured,
} from "../lib/claude/console-config";
import { CONSOLE_TOOLS, executeConsoleTool } from "../lib/claude/console-tools";
import { SECTION_IDS } from "../lib/design/layouts";

const ctx = { operatorEmail: "test@salishforge.com", sessionId: "sess_test" };

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("consoleCostCents", () => {
  it("is zero for an empty usage", () => {
    assert.equal(
      consoleCostCents({ input_tokens: 0, output_tokens: 0 }),
      0,
    );
  });

  it("prices one million input tokens at the input rate", () => {
    assert.equal(
      consoleCostCents({ input_tokens: 1_000_000, output_tokens: 0 }),
      300,
    );
  });

  it("prices one million output tokens at the output rate", () => {
    assert.equal(
      consoleCostCents({ input_tokens: 0, output_tokens: 1_000_000 }),
      1500,
    );
  });

  it("prices cache writes at 1.25x input and reads at 0.1x", () => {
    assert.equal(
      consoleCostCents({
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 1_000_000,
        cache_read_input_tokens: 1_000_000,
      }),
      375 + 30,
    );
  });

  it("treats null/omitted cache fields as zero", () => {
    assert.equal(
      consoleCostCents({
        input_tokens: 1_000_000,
        output_tokens: 0,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      }),
      300,
    );
  });
});

describe("Console config gates", () => {
  it("isConsoleConfigured tracks ANTHROPIC_API_KEY presence", () => {
    withEnv({ ANTHROPIC_API_KEY: undefined }, () => {
      assert.equal(isConsoleConfigured(), false);
    });
    withEnv({ ANTHROPIC_API_KEY: "sk-test" }, () => {
      assert.equal(isConsoleConfigured(), true);
    });
  });

  it("consoleCeilingCents defaults to 200 when unset or unparseable", () => {
    withEnv({ DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS: undefined }, () => {
      assert.equal(consoleCeilingCents(), 200);
    });
    withEnv({ DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS: "abc" }, () => {
      assert.equal(consoleCeilingCents(), 200);
    });
  });

  it("consoleCeilingCents parses an explicit ceiling", () => {
    withEnv({ DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS: "500" }, () => {
      assert.equal(consoleCeilingCents(), 500);
    });
  });

  it("consoleEnabled is false when unconfigured", () => {
    withEnv(
      {
        ANTHROPIC_API_KEY: undefined,
        DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS: "200",
      },
      () => assert.equal(consoleEnabled(), false),
    );
  });

  it("consoleEnabled is false when configured but the ceiling is zero", () => {
    withEnv(
      {
        ANTHROPIC_API_KEY: "sk-test",
        DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS: "0",
      },
      () => assert.equal(consoleEnabled(), false),
    );
  });

  it("consoleEnabled is true when configured and the ceiling is positive", () => {
    withEnv(
      {
        ANTHROPIC_API_KEY: "sk-test",
        DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS: "200",
      },
      () => assert.equal(consoleEnabled(), true),
    );
  });
});

describe("CONSOLE_TOOLS surface", () => {
  it("registers exactly the five curator tools", () => {
    const names = CONSOLE_TOOLS.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "list_font_pairings",
      "list_layouts",
      "list_palettes",
      "list_spacing_scales",
      "propose_revision",
    ]);
  });

  it("every tool declares an object input schema", () => {
    for (const tool of CONSOLE_TOOLS) {
      assert.equal(tool.input_schema.type, "object");
    }
  });

  it("propose_revision requires a rationale", () => {
    const propose = CONSOLE_TOOLS.find((t) => t.name === "propose_revision");
    assert.ok(propose);
    assert.deepEqual(propose.input_schema.required, ["rationale"]);
  });
});

describe("Console list executors", () => {
  it("list_palettes returns id/name/description rows", async () => {
    const { result } = await executeConsoleTool("list_palettes", {}, ctx);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    for (const row of result as Array<Record<string, unknown>>) {
      assert.equal(typeof row.id, "string");
      assert.equal(typeof row.name, "string");
      assert.equal(typeof row.description, "string");
    }
  });

  it("list_font_pairings returns id/name/label/description rows", async () => {
    const { result } = await executeConsoleTool("list_font_pairings", {}, ctx);
    assert.ok(Array.isArray(result));
    for (const row of result as Array<Record<string, unknown>>) {
      assert.equal(typeof row.id, "string");
      assert.equal(typeof row.label, "string");
    }
  });

  it("list_spacing_scales returns id/name/description rows", async () => {
    const { result } = await executeConsoleTool("list_spacing_scales", {}, ctx);
    assert.ok(Array.isArray(result));
    for (const row of result as Array<Record<string, unknown>>) {
      assert.equal(typeof row.id, "string");
    }
  });

  it("list_layouts with no section returns every section", async () => {
    const { result } = await executeConsoleTool("list_layouts", {}, ctx);
    const keys = Object.keys(result as Record<string, unknown>).sort();
    assert.deepEqual(keys, [...SECTION_IDS].sort());
  });

  it("list_layouts filters to a single valid section", async () => {
    const section = SECTION_IDS[0];
    const { result } = await executeConsoleTool(
      "list_layouts",
      { section },
      ctx,
    );
    assert.deepEqual(Object.keys(result as Record<string, unknown>), [section]);
    const variants = (result as Record<string, unknown[]>)[section];
    assert.ok(Array.isArray(variants) && variants.length > 0);
  });

  it("returns an error for an unknown tool", async () => {
    const { result } = await executeConsoleTool("delete_everything", {}, ctx);
    assert.ok(
      (result as { error?: string }).error?.includes("delete_everything"),
    );
  });
});
