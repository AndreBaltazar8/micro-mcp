import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
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

test("skill evaluations are structured and cover durable operations", async () => {
  const directory = resolve("tests/skill-evals");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json"));
  const evaluations = await Promise.all(files.map(async (name) =>
    await readFile(resolve(directory, name), "utf8").then(JSON.parse)));
  assert.equal(evaluations.length >= 4, true);
  evaluations.forEach((evaluation) => {
    assert.equal(typeof evaluation.name, "string");
    assert.equal(typeof evaluation.prompt, "string");
    assert.equal(Array.isArray(evaluation.mustMention), true);
    assert.equal(Array.isArray(evaluation.mustNotContain), true);
  });
  assert.equal(evaluations.some((evaluation) => evaluation.name === "scheduled-maintenance"), true);
  assert.equal(evaluations.some((evaluation) => evaluation.name === "verified-user-email"), true);
  assert.equal(evaluations.some((evaluation) => evaluation.name === "platform-incident-diagnosis"), true);
  assert.equal(evaluations.some((evaluation) => evaluation.name === "curated-gallery-remix"), true);
  assert.equal(evaluations.some((evaluation) => evaluation.name === "login-with-micro"), true);
});
