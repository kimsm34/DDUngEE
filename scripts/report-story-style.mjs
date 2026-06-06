import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const storyPath = process.argv[2] ? path.resolve(repoRoot, process.argv[2]) : path.join(repoRoot, "content", "level-1-natural-stories.js");
const source = fs.readFileSync(storyPath, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);

const stories = sandbox.window.ddungeeNaturalStories || [];
const markers = [
  ["느낌이었다", /느낌이었다/g],
  ["생각했다", /생각했다/g],
  ["생각이 들었다", /생각이 들었다/g],
  ["알게 되었다", /알게 되었다/g],
  ["깨달았다", /깨달았다/g],
  ["중요했다", /중요했다/g],
  ["의미가 있었다", /의미가 있었다/g],
  ["특별한 추억", /특별한 추억/g],
  ["큰 교훈", /큰 교훈/g],
  ["꽤 큰 교훈", /꽤 큰 교훈/g],
  ["그 순간", /그 순간/g],
  ["일반론 사람은", /사람은\s+(의외로|은근히|가끔|늘|생각보다)/g],
  ["여행에서 가장", /여행에서 가장/g],
  ["중요한 것은", /중요한 것은/g],
  ["무엇보다", /무엇보다/g],
];

const rows = stories.map((story, index) => {
  const body = (story.paragraphs || []).join("\n\n");
  const hits = markers
    .map(([label, pattern]) => [label, body.match(pattern)?.length || 0])
    .filter(([, count]) => count > 0);

  return {
    number: String(index + 1).padStart(3, "0"),
    length: body.length,
    hits,
  };
});

for (const row of rows) {
  if (row.hits.length) {
    console.log(`${row.number} len=${row.length} ${row.hits.map(([marker, count]) => `${marker}:${count}`).join(" ")}`);
  }
}

if (!rows.some((row) => row.hits.length)) {
  console.log("no flagged style markers");
}
