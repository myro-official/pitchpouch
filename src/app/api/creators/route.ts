import { saveCreator } from "@/lib/store";
import type { Creator } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Creator>;
  if (!body.handle || !body.followers) {
    return Response.json({ error: "아이디와 팔로워 수를 입력해 주세요." }, { status: 400 });
  }
  const creator = saveCreator({
    handle: body.handle,
    name: body.name?.trim() || body.handle,
    followers: Number(body.followers),
    avgViews: Number(body.avgViews) || 0,
    category: body.category || "뷰티",
  });
  return Response.json({ creator });
}
