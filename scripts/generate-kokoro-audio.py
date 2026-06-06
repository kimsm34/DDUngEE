#!/usr/bin/env python3
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf


REPO_ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = REPO_ROOT / "index.html"
OUTPUT_ROOT = REPO_ROOT / "assets" / "audio" / "level-1"
SAMPLE_RATE = 24000


def story_number(number):
    return str(number).zfill(3)


def parse_range(range_text, maximum):
    numbers = []
    for raw_part in range_text.split(","):
        part = raw_part.strip()
        if not part:
            continue
        if "-" in part:
            raw_start, raw_end = part.split("-", 1)
            start = int(raw_start)
            end = int(raw_end)
            if start < 1 or end < start:
                raise ValueError(f"Invalid range: {part}")
            numbers.extend(range(start, end + 1))
        else:
            value = int(part)
            if value < 1:
                raise ValueError(f"Invalid range item: {part}")
            numbers.append(value)

    return [number for number in dict.fromkeys(numbers) if number <= maximum]


def extract_final_lines(html):
    manual_matches = re.findall(r"manualStory\(\[[\s\S]*?\],\s*`([^`]+)`\s*\)", html)
    base_lines = [match.strip() for match in manual_matches[:100]]
    revision_pattern = re.compile(r"\[(\d+),\s*manualStory\(\[[\s\S]*?\],\s*`([^`]+)`\s*\)\]")

    for raw_index, sentence in revision_pattern.findall(html):
        index = int(raw_index)
        if 0 <= index < len(base_lines):
            base_lines[index] = sentence.strip()

    return [
        {
            "index": index + 1,
            "sentence": sentence,
            "file_name": f"{story_number(index + 1)}.m4a",
        }
        for index, sentence in enumerate(base_lines)
    ]


def prepare_espeak_runtime():
    import espeakng_loader
    from phonemizer.backend.espeak.wrapper import EspeakWrapper

    runtime = Path(tempfile.gettempdir()) / "ddungee-kokoro-runtime"
    runtime.mkdir(parents=True, exist_ok=True)

    loader_root = Path(espeakng_loader.__file__).resolve().parent
    for name in ("espeak-ng-data", "libespeak-ng.dylib"):
        source = loader_root / name
        target = runtime / name
        if target.exists() or target.is_symlink():
            if target.is_dir() and not target.is_symlink():
                shutil.rmtree(target)
            else:
                target.unlink()
        target.symlink_to(source)

    library_path = runtime / "libespeak-ng.dylib"
    os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = str(library_path)
    os.environ["PHONEMIZER_ESPEAK_DATA_PATH"] = str(runtime)
    EspeakWrapper.set_library(str(library_path))
    EspeakWrapper.set_data_path(str(runtime))


def synthesize_to_wav(pipeline, sentence, voice, speed, wav_path):
    chunks = []
    for _, _, audio in pipeline(sentence, voice=voice, speed=speed):
        chunks.append(audio)

    if not chunks:
        raise RuntimeError(f"No audio generated for: {sentence}")

    audio = np.concatenate(chunks)
    sf.write(wav_path, audio, SAMPLE_RATE)
    return len(audio) / SAMPLE_RATE


def convert_wav_to_m4a(wav_path, output_path):
    subprocess.run(
        ["afconvert", "-f", "m4af", "-d", "aac", "-q", "127", str(wav_path), str(output_path)],
        check=True,
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Generate local Kokoro TTS audio for DDungEE final lines.")
    parser.add_argument("--range", default="1-100", help="Episode range, e.g. 1-5 or 1-10,21,30")
    parser.add_argument("--voice", default="af_heart", help="Kokoro voice id")
    parser.add_argument("--speed", type=float, default=0.86, help="Speech speed")
    parser.add_argument("--force", action="store_true", help="Regenerate files that already exist")
    parser.add_argument("--dry-run", action="store_true", help="Print selected final lines without generating audio")
    return parser.parse_args()


def main():
    args = parse_args()
    html = INDEX_PATH.read_text(encoding="utf-8")
    final_lines = extract_final_lines(html)
    selected_indexes = parse_range(args.range, len(final_lines))
    selected_lines = [final_lines[index - 1] for index in selected_indexes]

    if not selected_lines:
        raise SystemExit(f"No final lines found for range {args.range!r}. Available: 1-{len(final_lines)}")

    print(f"Selected {len(selected_lines)} final line(s): {', '.join(map(str, selected_indexes))}")
    print(f"Voice: {args.voice}")
    print(f"Speed: {args.speed}")

    if args.dry_run:
        for item in selected_lines:
            print(f"{story_number(item['index'])}: {item['sentence']}")
        return

    if shutil.which("afconvert") is None:
        raise SystemExit("Missing afconvert. This script uses macOS afconvert to create compact m4a files.")

    prepare_espeak_runtime()

    from kokoro import KPipeline
    from phonemizer.backend.espeak.wrapper import EspeakWrapper

    EspeakWrapper.set_data_path(str(Path(tempfile.gettempdir()) / "ddungee-kokoro-runtime"))
    pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="ddungee-kokoro-wav-") as temp_dir:
        temp_root = Path(temp_dir)
        for item in selected_lines:
            output_path = OUTPUT_ROOT / item["file_name"]
            if output_path.exists() and not args.force:
                print(f"skip {item['file_name']} (already exists; use --force to regenerate)")
                continue

            wav_path = temp_root / f"{story_number(item['index'])}.wav"
            duration = synthesize_to_wav(pipeline, item["sentence"], args.voice, args.speed, wav_path)
            convert_wav_to_m4a(wav_path, output_path)
            size_kb = output_path.stat().st_size / 1024
            print(f"generated {item['file_name']} ({duration:.2f}s, {size_kb:.1f}KB)")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
