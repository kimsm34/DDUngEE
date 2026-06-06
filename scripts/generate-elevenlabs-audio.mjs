import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(repoRoot, "index.html");
const envPath = path.join(repoRoot, ".env");
const outputRoot = path.join(repoRoot, "assets", "audio", "level-1");

const defaults = {
  model: "eleven_multilingual_v2",
  outputFormat: "mp3_44100_128",
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  range: "1-5",
  delayMs: 650,
};

function parseArgs(argv) {
  const args = { ...defaults, dryRun: false, force: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--range" && next) {
      args.range = next;
      index += 1;
    } else if (arg === "--voice-id" && next) {
      args.voiceId = next;
      index += 1;
    } else if (arg === "--model" && next) {
      args.model = next;
      index += 1;
    } else if (arg === "--output-format" && next) {
      args.outputFormat = next;
      index += 1;
    } else if (arg === "--delay-ms" && next) {
      args.delayMs = Number(next);
      index += 1;
    }
  }

  args.voiceId = process.env.ELEVENLABS_VOICE_ID || args.voiceId;
  return args;
}

async function loadDotEnv() {
  try {
    const body = await fs.readFile(envPath, "utf8");
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) {
        continue;
      }

      const [rawKey, ...rawValue] = line.split("=");
      const key = rawKey.trim();
      const value = rawValue.join("=").trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function storyNumber(number) {
  return String(number).padStart(3, "0");
}

function parseRange(rangeText, max) {
  const ranges = rangeText.split(",").flatMap((part) => {
    const trimmed = part.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.includes("-")) {
      const [startText, endText] = trimmed.split("-");
      const start = Number(startText);
      const end = Number(endText);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
        throw new Error(`Invalid range: ${trimmed}`);
      }
      return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
    }

    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`Invalid range item: ${trimmed}`);
    }
    return [value];
  });

  return [...new Set(ranges)].filter((number) => number <= max);
}

function extractFinalLines(html) {
  const manualMatches = [...html.matchAll(/manualStory\(\[[\s\S]*?\],\s*`([^`]+)`\s*\)/g)];
  const baseLines = manualMatches.slice(0, 100).map((match) => match[1].trim());
  const revisionPattern = /\[(\d+),\s*manualStory\(\[[\s\S]*?\],\s*`([^`]+)`\s*\)\]/g;

  for (const match of html.matchAll(revisionPattern)) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && index >= 0 && index < baseLines.length) {
      baseLines[index] = match[2].trim();
    }
  }

  return baseLines.map((sentence, index) => ({
    index: index + 1,
    fileName: `${storyNumber(index + 1)}.mp3`,
    sentence,
  }));
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function generateSpeech({ apiKey, voiceId, model, outputFormat, text }) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
  url.searchParams.set("output_format", outputFormat);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: 0.56,
        similarity_boost: 0.78,
        style: 0.16,
        use_speaker_boost: true,
        speed: 0.92,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`ElevenLabs request failed (${response.status}): ${message}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  await loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const html = await fs.readFile(indexPath, "utf8");
  const finalLines = extractFinalLines(html);
  const selectedIndexes = parseRange(args.range, finalLines.length);
  const selectedLines = selectedIndexes.map((number) => finalLines[number - 1]);

  if (selectedLines.length === 0) {
    throw new Error(`No final lines found for range "${args.range}". Available: 1-${finalLines.length}`);
  }

  console.log(`Selected ${selectedLines.length} final line(s): ${selectedIndexes.join(", ")}`);
  console.log(`Voice: ${args.voiceId}`);
  console.log(`Model: ${args.model}`);
  console.log(`Format: ${args.outputFormat}`);

  if (args.dryRun) {
    for (const item of selectedLines) {
      console.log(`${storyNumber(item.index)}: ${item.sentence}`);
    }
    return;
  }

  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY. Put it in .env or export it in your shell.");
  }

  await fs.mkdir(outputRoot, { recursive: true });

  for (const item of selectedLines) {
    const outputPath = path.join(outputRoot, item.fileName);
    if (!args.force && (await fileExists(outputPath))) {
      console.log(`skip ${item.fileName} (already exists; use --force to regenerate)`);
      continue;
    }

    console.log(`generate ${item.fileName}: ${item.sentence}`);
    const audio = await generateSpeech({
      apiKey,
      voiceId: args.voiceId,
      model: args.model,
      outputFormat: args.outputFormat,
      text: item.sentence,
    });
    await fs.writeFile(outputPath, audio);
    await sleep(args.delayMs);
  }

  console.log("done");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
