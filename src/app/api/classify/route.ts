import { z } from "zod";
import { CONFIDENCE_THRESHOLD, classifyDm, costUsd, MODEL } from "@/lib/classify";
import type { ClassifyResponse } from "@/lib/inbox";

const Body = z.object({
  messages: z.array(z.object({ id: z.string().max(64), text: z.string().trim().min(1).max(2000) })).min(1).max(20),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "DM은 1~20개, 한 개당 2000자까지 보낼 수 있어요." }, { status: 400 });

  const { messages } = parsed.data;
  const outcomes = [];
  // 한 번에 5개씩만 동시에 호출해 속도 제한에 걸리지 않게 한다.
  for (let i = 0; i < messages.length; i += 5) {
    outcomes.push(...(await Promise.all(messages.slice(i, i + 5).map((m) => classifyDm(m.text)))));
  }

  const inputTokens = outcomes.reduce((n, o) => n + o.inputTokens, 0);
  const outputTokens = outcomes.reduce((n, o) => n + o.outputTokens, 0);
  const ai = outcomes.filter((o) => o.result.source === "ai").length;
  const constrained = outcomes.filter((o) => o.result.stage?.constrained).length;
  const body: ClassifyResponse = {
    results: outcomes.map((o, i) => ({ id: messages[i].id, ...o.result })),
    usage: { model: MODEL, ai, rules: outcomes.length - ai, constrained, threshold: CONFIDENCE_THRESHOLD, inputTokens, outputTokens, costUsd: costUsd(inputTokens, outputTokens) },
  };
  return Response.json(body);
}
