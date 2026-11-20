import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";

test("website inline JavaScript parses successfully", () => {
  const htmlPath = path.resolve(process.cwd(), "..", "index.html");
  const html = readFileSync(htmlPath, "utf8");
  const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)]
    .map(match => match[1].trim())
    .filter(Boolean);

  assert.ok(scripts.length > 0, "Expected at least one inline script in index.html");
  for (const [index, source] of scripts.entries()) {
    assert.doesNotThrow(
      () => new vm.Script(source, { filename: `index.html:inline-script-${index + 1}` }),
      `Inline script ${index + 1} must have valid JavaScript syntax`
    );
  }
});
