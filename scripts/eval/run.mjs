// 라벨이 붙은 DM으로 분류 방식(v1, v2)을 비교한다.
// 사용: node scripts/eval/run.mjs [세트 접두사, 기본 dm-labeled] [서버 주소]
//   예) node scripts/eval/run.mjs dm-new   → 새 평가 데이터만
//       node scripts/eval/run.mjs dm-      → 모든 세트
import { readdirSync, readFileSync } from "node:fs";

const PREFIX = process.argv[2] ?? "dm-labeled";
const BASE = process.argv[3] ?? "https://pitchpouch.vercel.app";
const dir = new URL("./", import.meta.url);
const data = readdirSync(dir)
  .filter((f) => f.startsWith(PREFIX) && f.endsWith(".json"))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, dir))));
const LABEL = { gain: "수익 기회", rel: "관계", todo: "처리할 일", junk: "걸러낼 것", unclear: "애매함" };

async function run(profile) {
  const results = [];
  const usage = [];
  for (let i = 0; i < data.length; i += 20) {
    const res = await fetch(`${BASE}/api/classify`, {
      method: "POST",
      // audit 0: 표본 검수가 섞이지 않게 해서 같은 입력이 같은 경로를 타게 한다
      body: JSON.stringify({ profile, audit: 0, messages: data.slice(i, i + 20).map((d) => ({ id: d.id, text: d.text })) }),
    });
    if (!res.ok) throw new Error(`요청 실패 ${res.status}`);
    const json = await res.json();
    results.push(...json.results);
    usage.push(json.usage);
  }
  const by = Object.fromEntries(results.map((r) => [r.id, r]));
  const rows = data.map((d) => ({ ...d, r: by[d.id] }));
  return { rows, usage };
}

const sum = (u, k) => u.reduce((n, x) => n + x[k], 0);
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}%` : "-");
const n = data.length;
console.log(`세트 ${PREFIX}*: DM ${n}개 (경계 ${data.filter((d) => d.boundary).length}개, 걸러낼 것 ${data.filter((d) => d.group === "junk").length}개)\n`);

for (const profile of ["v1", "v2"]) {
  const { rows, usage } = await run(profile);
  const noAi = rows.filter((x) => x.r.source === "rules").length;
  if (noAi) console.log(`주의: 규칙 분류 ${noAi}개 — Jev나 Claude가 응답하지 않았어요\n`);
  const ok = (x) => x.r.group === x.group;
  const acc = rows.filter((x) => x.r.jev?.accepted);
  const wrongAcc = acc.filter((x) => !ok(x));
  const jevOk = rows.filter((x) => x.r.jev && x.r.jev.group === x.group).length;
  const why = {};
  for (const x of rows) if (x.r.jev && !x.r.jev.accepted) why[x.r.jev.why] = (why[x.r.jev.why] ?? 0) + 1;
  const junk = rows.filter((x) => x.group === "junk");
  const junkMiss = junk.filter((x) => x.r.group !== "junk");
  const nonJunkAsJunk = rows.filter((x) => x.group !== "junk" && x.r.group === "junk");
  const claudeIn = sum(usage, "inputTokens");
  const cost = (sum(usage, "jevCostUsd") + (sum(usage, "costUsd") ?? 0)) / n;
  console.log(`== ${profile}`);
  console.log(`최종 정확도 ${pct(rows.filter(ok).length, n)} (${rows.filter(ok).length}/${n}), 명확 ${pct(rows.filter((x) => !x.boundary && ok(x)).length, rows.filter((x) => !x.boundary).length)}, 경계 ${pct(rows.filter((x) => x.boundary && ok(x)).length, rows.filter((x) => x.boundary).length)}`);
  console.log(`Jev 단독 정확도 ${pct(jevOk, rows.filter((x) => x.r.jev).length)}, Jev가 채택된 ${acc.length}개 중 오답 ${wrongAcc.length}개 (확신한 오류)`);
  console.log(`Claude로 넘어간 DM ${n - acc.length}개 (${pct(n - acc.length, n)}), 이유 ${JSON.stringify(why)}, DM당 비용 $${cost.toFixed(6)}`);
  console.log(`걸러낼 것을 놓침 ${junkMiss.length}/${junk.length}, 다른 것을 걸러낼 것으로 오분류 ${nonJunkAsJunk.length}`);
  for (const x of rows.filter((y) => !ok(y))) {
    const j = x.r.jev;
    console.log(`  X ${x.id} 정답 ${LABEL[x.group]} → ${LABEL[x.r.group]} (${x.r.source}) | Jev ${j ? `${LABEL[j.group]} ${j.confidence} ${j.accepted ? "채택" : j.why}` : "없음"} | ${x.text.replace(/\n/g, " ").slice(0, 36)}`);
  }
  console.log();
}
