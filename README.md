# DDungEE Cabin Diary

승무원을 꿈꾸는 정민이를 위한 토익 단어 스토리 프로토타입입니다.

## Prototype

- 단일 `index.html` 정적 사이트
- Level 1 TOEIC 기본 단어 100개 콘텐츠
- Level 2~4 잠금 레벨 UI
- 브라우저에서 바로 열 수 있고 Vercel, Netlify, GitHub Pages에 그대로 배포 가능

## Story Rules

- 단어는 토익 빈출어를 쓰되, 이야기는 시험 예문처럼 쓰지 않는다.
- 기본 톤은 귀엽고 웃긴 실제 일상형으로 간다. 정민이가 조금 허둥대고, 배고프고, 귀여운 것에 약한 사람처럼 보여야 한다.
- Level 1~2에서는 이야기 본문에 목표 영어 단어와 영어 대사를 숨긴다.
- Level 3부터는 쉬운 영어 단어와 짧은 영어 문장을 에피소드 안에 자연스럽게 섞는다. 사용자가 한국어 이야기를 읽는 흐름 안에서 영어도 편하게 읽는 습관을 들이게 하는 것이 목적이다.
- 레벨이 높아질수록 에피소드 안의 영어 문장 비중을 조금씩 늘리되, 한국어 몰입감과 장면의 자연스러움은 유지한다.
- Final Line은 그 상황에서 원어민이 실제로 말할 법한 자연스러운 문장이어야 한다.
- Final Line은 이야기의 핵심 행동이나 핵심 상황을 직접 말해야 한다.
- 단어를 억지로 끼워 넣지 않고, 그 단어가 정말 쓰이는 상황을 먼저 고른다.
- 독자가 질문하게 만드는 애매한 상황은 피하고, 장면 자체가 단어의 쓰임을 설명하게 만든다.
- 장면마다 작은 웃김, 당황, 고생, 다정함, 울컥함을 섞어 읽는 리듬을 만든다.
- 문장웹진 소설은 문학체를 따라 하기 위한 참고가 아니라, 한국적인 국어 감각과 자연스러운 이야기 호흡을 확인하는 기준으로만 쓴다.
- 자세한 작성 프롬프트는 [DDungEE Story Prompt](./story-prompt.md)를 따른다.

## Word Plan

- [Level 1 Word List Draft](./level-1-word-list.md): 300-word Level 1 draft with TOEIC selection basis.

## Audio Generation

기본 음성은 무료 오픈소스 Kokoro TTS로 로컬 생성한다. 브라우저에서 API를 호출하지 않고, 미리 만든 m4a 파일을 `assets/audio/level-1`에 저장한다.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-kokoro.txt
.venv/bin/python scripts/generate-kokoro-audio.py --range 1-100 --force
```

- 기본 출력: `assets/audio/level-1/001.m4a`
- 기본 음성: `af_heart`
- 목소리 변경 예시: `.venv/bin/python scripts/generate-kokoro-audio.py --range 1-5 --voice af_sky --force`

ElevenLabs는 더 높은 품질이 필요할 때 쓰는 선택지다. 이 경우에도 API 키를 브라우저에 넣지 않고, 로컬에서 mp3 파일을 미리 생성한다.

```bash
cp .env.example .env
# .env에 ELEVENLABS_API_KEY 입력
node scripts/generate-elevenlabs-audio.mjs --range 1-5 --force
```

- 기본 출력: `assets/audio/level-1/001.mp3`
- 전체 생성 예시: `node scripts/generate-elevenlabs-audio.mjs --range 1-100 --force`
- 목소리 변경: `ELEVENLABS_VOICE_ID`를 `.env`에서 바꾸거나 `--voice-id` 옵션을 쓴다.

## Next

- 정민이 취향에 맞춘 에피소드별 장면 밀도 추가 개선
- 학습 완료 체크
- PDF 출력용 스타일
- 모바일 카드 인터랙션 개선

## Image Credits

- Airplane window assets are prototype images sourced from Unsplash.
