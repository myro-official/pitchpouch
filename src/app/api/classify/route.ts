import { z } from "zod";
import { CONFIDENCE_THRESHOLD, classifyDm, costUsd, JEV_USD_PER_M_INPUT, MODEL, type Outcome } from "@/lib/classify";
import type { ClassifyResponse } from "@/lib/inbox";

// threshold는 기준값 비교 시험용이다(0이면 Jev만, 1.1이면 Claude만). 비용은 시간당 호출 한도가 막는다.
const Body = z.object({
  threshold: z.number().min(0).max(1.1).optional(),
  messages: z.array(z.object({ id: z.string().max(64), text: z.string().trim().min(1).max(2000) })).min(1).max(20),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "DM은 1~20개, 한 개당 2000자까지 보낼 수 있어요." }, { status: 400 });

  const { messages, threshold = CONFIDENCE_THRESHOLD } = parsed.data;
  const outcomes: Outcome[] = [];
  // 한 번에 5개씩만 동시에 호출해 속도 제한에 걸리지 않게 한다.
  for (let i = 0; i < messages.length; i += 5) {
    outcomes.push(...(await Promise.all(messages.slice(i, i + 5).map((m) => classifyDm(m.text, threshold)))));
  }

  const sum = (pick: (o: Outcome) => number) => outcomes.reduce((n, o) => n + pick(o), 0);
  const count = (source: string) => outcomes.filter((o) => o.result.source === source).length;
  const inputTokens = sum((o) => o.inputTokens);
  const outputTokens = sum((o) => o.outputTokens);
  const body: ClassifyResponse = {
    results: outcomes.map((o, i) => ({ id: messages[i].id, ...o.result })),
    usage: {
      model: MODEL,
      jev: count("jev"),
      ai: count("ai"),
      rules: count("rules"),
      threshold,
      jevInputTokens: sum((o) => o.jevInputTokens),
      jevCostUsd: (sum((o) => o.jevInputTokens) * JEV_USD_PER_M_INPUT) / 1_000_000,
      inputTokens,
      outputTokens,
      costUsd: costUsd(inputTokens, outputTokens),
    },
  };
  return Response.json(body);
}
