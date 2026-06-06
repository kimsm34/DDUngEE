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
  ["번역투 대명사", /그녀[가-힣]*/g],
  ["일반론 사람은", /사람은\s+(의외로|은근히|가끔|늘|생각보다)/g],
  ["여행에서 가장", /여행에서 가장/g],
  ["중요한 것은", /중요한 것은/g],
  ["무엇보다", /무엇보다/g],
  ["어색한 의인화", /(방한테|마음이 밥상|단맛 쪽|사람 몫|마음 회의|응급실 투어|신분 상승|숫자가 나한테|호텔이랑 화해|발이 회의|마음만 입수|밥이 우리를 부른다|오늘의 답|손목을 잡아끈다|발이 중간에 퇴사|목도 나랑 한편|향기가 이미 대기|숫자가 아직 집에)/g],
  ["과한 번역투 농담", /(내 마음이 방금 계산|계절은 기다려 주지|예민한 협상|덜 준비됐대|길이 너무 모르는 척|토끼 접시가 떠났어|공짜라는 말이 버터랑|정돈된 나|오늘 회의는 성공|캐리어도, 지갑도|못 믿게 생겼어|바닥이 됐어|말투가 안 좋아|내일의 나도|빵의 가능성|취업했네|계절을 아주 노골적으로|사람 손을 많이|말은 들어봐야지|거의 선언문|종이가 잠수|앞자리 탔네|하루 끝에 꼭 얼굴|덜 다치게|밴드 사냥|시험처럼 굴러간다|케이크가 너를 단련|진한 쪽으로|추천 목록)/g],
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
