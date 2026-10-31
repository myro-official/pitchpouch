// 라벨이 붙은 DM으로 신뢰도 기준별 정확도·비용을 비교한다. 사용: node scripts/eval/run.mjs [서버 주소]
import { readdirSync, readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "https://pitchpouch.vercel.app";
const dir = new URL("./", import.meta.url);
const data = readdirSync(dir)
  .filter((f) => /^dm-labeled.*\.json$/.test(f))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, dir))));
const LABEL = { gain: "수익 기회", rel: "관계", todo: "처리할 일", junk: "걸러낼 것" };

async function run(threshold) {
  const results = [];
  const usage = [];
  for (let i = 0; i < data.length; i += 20) {
    const res = await fetch(`${BASE}/api/classify`, {
      method: "POST",
      body: JSON.stringify({ threshold, messages: data.slice(i, i + 20).map((d) => ({ id: d.id, text: d.text })) }),
    });
    if (!res.ok) throw new Error(`요청 실패 ${res.status}`);
    const json = await res.json();
    results.push(...json.results);
    usage.push(json.usage);
  }
  return { results, usage };
}

// 기준을 1.1로 두면 Claude가 전부 판정하면서 응답에 Jev의 판정과 신뢰도도 같이 남는다. 한 번의 호출로 어떤 기준이든 계산할 수 있다.
const both = await run(1.1);
const jevRun = both;
const claudeRun = both;
const byId = (r) => Object.fromEntries(r.results.map((x) => [x.id, x]));
const J = byId(both);
const C = J;
const sum = (u, k) => u.reduce((n, x) => n + x[k], 0);

const rows = data.map((d) => ({ ...d, jev: J[d.id].jev?.group ?? null, conf: J[d.id].jev?.confidence ?? null, claude: C[d.id].group, claudeSource: C[d.id].source }));
const missing = rows.filter((r) => r.conf === null).length;
const claudeFail = rows.filter((r) => r.claudeSource !== "ai").length;
if (missing || claudeFail) console.log(`주의: Jev 응답 없음 ${missing}개, Claude 대신 규칙 ${claudeFail}개\n`);

const n = rows.length;
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}%` : "-");
const jevCost = sum(jevRun.usage, "jevCostUsd") / n;
const claudeCost = sum(claudeRun.usage, "costUsd") / n;

console.log(`DM ${n}개 (경계 사례 ${rows.filter((r) => r.boundary).length}개)`);
console.log(`Jev만: ${pct(rows.filter((r) => r.jev === r.group).length, n)}, Claude만: ${pct(rows.filter((r) => r.claude === r.group).length, n)}`);
console.log(`DM당 비용: Jev $${jevCost.toFixed(6)}, Claude $${claudeCost.toFixed(6)}\n`);

console.log("기준  채택 Jev정답  넘김 최종정확도 (명확/경계)       DM당 비용");
for (const th of [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) {
  const fin = rows.map((r) => ({ ...r, final: r.conf >= th ? r.jev : r.claude, acc: r.conf >= th }));
  const acc = fin.filter((r) => r.acc);
  const ok = (xs) => xs.filter((r) => r.final === r.group).length;
  const clear = fin.filter((r) => !r.boundary);
  const bound = fin.filter((r) => r.boundary);
  const cost = jevCost + ((n - acc.length) / n) * claudeCost;
  console.log(
    `${th.toFixed(2)}  ${String(acc.length).padStart(3)}  ${pct(acc.filter((r) => r.jev === r.group).length, acc.length).padStart(5)}  ${String(n - acc.length).padStart(4)}  ${pct(ok(fin), n).padStart(5)} (${pct(ok(clear), clear.length)}/${pct(ok(bound), bound.length)})  $${cost.toFixed(6)}`,
  );
}

console.log("\nJev가 틀린 DM:");
for (const r of rows.filter((x) => x.jev !== x.group)) {
  console.log(`#${r.id} 정답 ${LABEL[r.group]} / Jev ${LABEL[r.jev]} ${r.conf} / Claude ${LABEL[r.claude]} ${r.claude === r.group ? "O" : "X"}${r.boundary ? " [경계]" : ""} | ${r.text.slice(0, 40)}`);
}
console.log("\nClaude가 틀린 DM:");
for (const r of rows.filter((x) => x.claude !== x.group)) {
  console.log(`#${r.id} 정답 ${LABEL[r.group]} / Claude ${LABEL[r.claude]} / Jev ${LABEL[r.jev]} ${r.conf}${r.boundary ? " [경계]" : ""} | ${r.text.slice(0, 40)}`);
}
