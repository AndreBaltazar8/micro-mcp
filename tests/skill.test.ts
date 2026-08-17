import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

test("skill routes every linked reference and contains no placeholders", async () => {
  const skillPath = resolve("skills/micro-sites/SKILL.md");
  const source = await readFile(skillPath, "utf8");
  assert.match(source, /^---\nname: micro-sites\ndescription: .+\n---/);
  assert.equal(source.includes("TODO"), false);
  const links = [...source.matchAll(/\]\((references\/[^)]+)\)/g)].map(
    (match) => match[1],
  );
  assert.equal(links.length >= 9, true);
  await Promise.all(links.map(async (link) => await access(resolve(dirname(skillPath), link!))));
});

test("release metadata agrees", async () => {
  const [packageJson, pluginJson, serverJson, compatibility] = await Promise.all([
    readFile("package.json", "utf8").then(JSON.parse),
    readFile(".codex-plugin/plugin.json", "utf8").then(JSON.parse),
    readFile("server.json", "utf8").then(JSON.parse),
    readFile("compatibility.json", "utf8").then(JSON.parse),
  ]);
  assert.equal(packageJson.version, pluginJson.version);
  assert.equal(packageJson.version, serverJson.version);
  assert.equal(packageJson.version, compatibility.microMcp);
  assert.equal(packageJson.mcpName, serverJson.name);
  assert.equal(serverJson.packages[0].identifier, packageJson.name);
  assert.equal(serverJson.packages[0].version, packageJson.version);
});
