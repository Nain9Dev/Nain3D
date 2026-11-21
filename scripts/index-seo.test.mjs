import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// SPEC: the entry page carries its meaning in the HTML that crawlers receive before any script runs.
const html = readFileSync(new URL("../Nain3D.Client/index.html", import.meta.url), "utf8");
const squash = (text) => text.replace(/\s+/g, " ");

test("has a noscript fallback with one h1, the description and the repository link", () => {
  const match = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(match, "noscript block missing");
  const fallback = squash(match[1]);
  assert.equal((fallback.match(/<h1[\s>]/g) ?? []).length, 1);
  const description = html.match(/name="description"\s+content="([^"]+)"/)[1];
  assert.ok(fallback.includes(squash(description)));
  assert.ok(fallback.includes("https://github.com/Nain9Dev/Nain3D"));
});
