// 라벨 DM을 실제 분류 파이프라인에 통과시켜 더미 받은함 데이터(src/lib/dummy.json)를 만든다.
// 사용: node scripts/eval/build-dummy.mjs [복제 횟수] [서버 주소]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const COPIES = Number(process.argv[2] ?? 2);
const BASE = process.argv[3] ?? "https://pitchpouch.vercel.app";
const dir = new URL("./", import.meta.url);
const labeled = readdirSync(dir)
  .filter((f) => /^dm-labeled.*\.json$/.test(f))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, dir))));

// 같은 입력이면 같은 더미가 나오도록 시드를 고정한다.
let seed = 20261101;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

const SUR = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황"];
const GIV = ["민서", "서연", "지우", "하윤", "도현", "서준", "예은", "지민", "수아", "현우", "유나", "채원", "시우", "나은", "준서", "다인", "소율", "태민"];
const BRANDS = ["에이블랩", "비바랩", "모이스트온", "루미에르", "데일리핏", "소프트레이어", "그린노트", "하루결", "코튼앤", "오브제랩", "닥터앤솔", "플로우샵", "바이오로그", "스튜디오모아", "리프레시", "마이플랜", "아뜰리에온", "넥스트뷰티", "퓨어로직", "제이컴퍼니"];
const WORDS = ["daily", "mini", "soft", "lov", "my", "the", "sun", "moon", "hey", "pure", "yoon", "bom", "haru", "coco", "toto"];

const handleFor = (name, group) => {
  if (group === "junk") return `user_${Math.floor(rand() * 90000 + 10000)}`;
  if (group === "gain") return `${pick(WORDS)}.${["official", "kr", "shop", "lab", "studio"][Math.floor(rand() * 5)]}`;
  return `${pick(WORDS)}_${Math.floor(rand() * 9000 + 1000)}`;
};

async function classify(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 20) {
    const res = await fetch(`${BASE}/api/classify`, {
      method: "POST",
      body: JSON.stringify({ threshold: 0.8, messages: texts.slice(i, i + 20).map((t, j) => ({ id: String(i + j), text: t })) }),
    });
    if (!res.ok) throw new Error(`요청 실패 ${res.status}`);
    out.push(...(await res.json()).results);
  }
  return out;
}

const results = await classify(labeled.map((d) => d.text));
const bad = results.filter((r) => r.source === "rules").length;
if (bad) throw new Error(`규칙 분류 ${bad}개 — Jev나 Claude가 응답하지 않았어요. 다시 시도해 주세요.`);

const rows = [];
for (let c = 0; c < COPIES; c++) {
  labeled.forEach((d, i) => {
    const r = results[i];
    const name =
      r.group === "junk" ? "익명" : r.group === "gain" ? pick(BRANDS) : `${pick(SUR)}${pick(GIV)}`;
    // 최근일수록 많이 오도록 치우친 분포. 가장 최근 30분은 손으로 쓴 DM이 차지한다.
    const day = Math.floor(30 * Math.pow(rand(), 1.7));
    const minutesAgo = 30 + day * 1440 + Math.floor(rand() * 1440);
    const recent = minutesAgo < 2880;
    const read = recent ? rand() < 0.35 : rand() < 0.97;
    const done = read && (r.group === "junk" ? rand() < 0.2 : rand() < (recent ? 0.3 : 0.8));
    rows.push({
      name,
      handle: handleFor(name, r.group),
      minutesAgo,
      text: d.text,
      group: r.group,
      reply: r.reply,
      urgency: r.urgency,
      terms: r.terms,
      termsNote: r.termsNote,
      reason: r.reason,
      source: r.source,
      jev: r.jev,
      read,
      done,
    });
  });
}
rows.sort((a, b) => a.minutesAgo - b.minutesAgo);
rows.forEach((r, i) => (r.id = `d${i + 1}`));
writeFileSync(new URL("../../src/lib/dummy.json", import.meta.url), JSON.stringify(rows, null, 1));
const n = (f) => rows.filter(f).length;
console.log(`더미 ${rows.length}개 (고유 ${labeled.length}개 × ${COPIES}), 안읽음 ${n((r) => !r.read)}, 확인 안 함 ${n((r) => !r.done)}`);
console.log("그룹별:", ["gain", "rel", "todo", "junk"].map((g) => `${g} ${n((r) => r.group === g)}`).join(", "));
