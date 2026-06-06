import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const storyPath = path.join(repoRoot, "content", "level-1-natural-stories.js");
const draftsDir = path.join(repoRoot, "drafts");
const draftFiles = fs.existsSync(draftsDir)
  ? fs
      .readdirSync(draftsDir)
      .filter((fileName) => /^rewrite-\d{3}-\d{3}\.js$/.test(fileName))
      .sort()
      .map((fileName) => path.join(draftsDir, fileName))
  : [];

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
  const embeddedDialogue = (story.paragraphs || []).filter(
    (paragraph) => paragraph.includes("\"") && !/^"[^"]+"$/.test(paragraph),
  );
  const failures = [];

  if (!Number.isInteger(story.index) || story.index < 1 || story.index > 100) {
    failures.push("invalid index");
  }

  if (!Array.isArray(story.paragraphs) || story.paragraphs.length < 10 || story.paragraphs.length > 24) {
    failures.push(`paragraph count ${story.paragraphs?.length ?? 0}`);
  }

  if (body.length < 750) {
    failures.push(`body too short (${body.length})`);
  }

  if (quoteCount < 2) {
    failures.push(`not enough dialogue (${quoteCount})`);
  }

  if (embeddedDialogue.length) {
    failures.push("dialogue embedded in narration");
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

if (!draftStories.size) {
  failures.push("no draft stories found");
}

if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}

const nextStories = currentStories.map((story, index) => draftStories.get(index + 1) || story);
const output = `window.ddungeeNaturalStories = [
${nextStories.map(formatStory).join(",\n")}
];
`;

fs.writeFileSync(storyPath, output);
console.log(`applied ${nextStories.length} stories`);
