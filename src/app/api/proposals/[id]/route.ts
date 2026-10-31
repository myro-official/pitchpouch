import { getCreator, getProposal, updateProposal } from "@/lib/store";
import type { ProposalStatus } from "@/lib/types";

type Action =
  | { action: "counter"; items: string[]; message: string }
  | { action: "accept" }
  | { action: "reject" }
  | { action: "brand_accept"; reply?: string }
  | { action: "brand_reject"; reply?: string }
  | { action: "brand_revise"; reply: string };

export async function GET(_request: Request, ctx: RouteContext<"/api/proposals/[id]">) {
  const { id } = await ctx.params;
  const proposal = getProposal(id);
  if (!proposal) return Response.json({ error: "제안을 찾을 수 없어요." }, { status: 404 });
  return Response.json({ proposal, creator: getCreator(proposal.handle) });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/proposals/[id]">) {
  const { id } = await ctx.params;
  if (!getProposal(id)) return Response.json({ error: "제안을 찾을 수 없어요." }, { status: 404 });
  const body = (await request.json()) as Action;

  const status: Record<Action["action"], ProposalStatus> = {
    counter: "countered",
    accept: "accepted",
    reject: "rejected",
    brand_accept: "brand_accepted",
    brand_reject: "brand_rejected",
    brand_revise: "brand_revised",
  };

  const patch =
    body.action === "counter"
      ? { status: status.counter, counter: { items: body.items, message: body.message, at: new Date().toISOString() } }
      : body.action.startsWith("brand_")
        ? { status: status[body.action], brandReply: "reply" in body ? (body.reply ?? null) : null }
        : { status: status[body.action] };

  return Response.json({ proposal: updateProposal(id, patch) });
}
