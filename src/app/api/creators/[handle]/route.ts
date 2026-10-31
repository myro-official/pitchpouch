import { getCreator } from "@/lib/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/creators/[handle]">) {
  const { handle } = await ctx.params;
  const creator = getCreator(decodeURIComponent(handle));
  if (!creator) return Response.json({ error: "없는 링크예요." }, { status: 404 });
  return Response.json({ creator });
}
