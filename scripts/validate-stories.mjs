import fs from "node:fs";
import vm from "node:vm";

const storyPath = new URL("../content/level-1-natural-stories.js", import.meta.url);
const source = fs.readFileSync(storyPath, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);

const stories = sandbox.window.ddungeeNaturalStories || [];
const failures = [];

stories.forEach((story, index) => {
  const body = (story.paragraphs || []).join("\n\n");
  const number = String(index + 1).padStart(3, "0");
  const quoteCount = (body.match(/"/g) || []).length / 2;

  if (body.length < 650) {
    failures.push(`${number}: body too short (${body.length})`);
  }

  if (quoteCount < 2) {
    failures.push(`${number}: not enough dialogue (${quoteCount})`);
  }

  if (/[A-Za-z]/.test(body)) {
    failures.push(`${number}: English leaked into body`);
  }
});

console.log(`stories: ${stories.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exitCode = 1;
}
