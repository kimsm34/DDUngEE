import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const storyPath = path.join(repoRoot, "content", "level-1-natural-stories.js");
const draftFiles = [
  "drafts/rewrite-001-025.js",
  "drafts/rewrite-026-050.js",
  "drafts/rewrite-051-075.js",
  "drafts/rewrite-076-100.js",
].map((filePath) => path.join(repoRoot, filePath));

function loadCurrentStories() {
  const source = fs.readFileSync(storyPath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.ddungeeNaturalStories || [];
}

function bodyOf(story) {
  return (story.paragraphs || []).join("\n\n");
}

function validateStory(story) {
  const body = bodyOf(story);
  const quoteCount = (body.match(/"/g) || []).length / 2;
  const failures = [];

  if (!Number.isInteger(story.index) || story.index < 1 || story.index > 100) {
    failures.push("invalid index");
  }

  if (!Array.isArray(story.paragraphs) || story.paragraphs.length < 4 || story.paragraphs.length > 6) {
    failures.push(`paragraph count ${story.paragraphs?.length ?? 0}`);
  }

  if (body.length < 750) {
    failures.push(`body too short (${body.length})`);
  }

  if (quoteCount < 2) {
    failures.push(`not enough dialogue (${quoteCount})`);
  }

  if (/[A-Za-z]/.test(body)) {
    failures.push("English leaked into body");
  }

  return failures;
}

function templateLiteral(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

function formatStory(story) {
  const paragraphs = story.paragraphs.map((paragraph) => `      \`${templateLiteral(paragraph)}\`,`).join("\n");

  return `  {
    paragraphs: [
${paragraphs}
    ],
    sentence: \`${templateLiteral(story.sentence)}\`,
  }`;
}

const currentStories = loadCurrentStories();
const draftStories = new Map();
const failures = [];

for (const draftFile of draftFiles) {
  if (!fs.existsSync(draftFile)) {
    failures.push(`missing draft: ${path.relative(repoRoot, draftFile)}`);
    continue;
  }

  const module = await import(pathToFileURL(draftFile).href + `?t=${Date.now()}`);
  const stories = module.default;

  if (!Array.isArray(stories)) {
    failures.push(`${path.relative(repoRoot, draftFile)} does not export an array`);
    continue;
  }

  for (const story of stories) {
    if (draftStories.has(story.index)) {
      failures.push(`${String(story.index).padStart(3, "0")}: duplicate draft`);
      continue;
    }

    const current = currentStories[story.index - 1];
    if (!current) {
      failures.push(`${String(story.index).padStart(3, "0")}: missing current story`);
      continue;
    }

    if (story.sentence !== current.sentence) {
      failures.push(`${String(story.index).padStart(3, "0")}: sentence changed`);
    }

    const storyFailures = validateStory(story);
    if (storyFailures.length) {
      failures.push(`${String(story.index).padStart(3, "0")}: ${storyFailures.join(", ")}`);
    }

    draftStories.set(story.index, story);
  }
}

for (let index = 1; index <= currentStories.length; index += 1) {
  if (!draftStories.has(index)) {
    failures.push(`${String(index).padStart(3, "0")}: missing draft story`);
  }
}

if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}

const nextStories = Array.from({ length: currentStories.length }, (_, index) => draftStories.get(index + 1));
const output = `window.ddungeeNaturalStories = [
${nextStories.map(formatStory).join(",\n")}
];
`;

fs.writeFileSync(storyPath, output);
console.log(`applied ${nextStories.length} stories`);
