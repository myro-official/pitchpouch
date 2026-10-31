import { connection } from "next/server";
import { canViewDms } from "@/lib/dms";
import { createClient } from "@/lib/supabase/server";

type Ig = { name?: string; username: string; profile_picture_url?: string; followers_count?: number };

// 연결된 인스타 계정의 이름, 아이디, 사진, 팔로워 수. 그 계정의 DM을 볼 수 있는 사람에게만 준다.
export async function GET() {
  await connection();
  try {
    const { data } = await (await createClient()).auth.getUser();
    if (!data.user) return Response.json({ profile: null }, { status: 401 });
    if (!canViewDms(data.user)) return Response.json({ profile: null });

    const fields = "name,username,profile_picture_url,followers_count";
    const res = await fetch(
      `https://graph.facebook.com/v24.0/${process.env.IG_USER_ID}?fields=${fields}&access_token=${process.env.IG_ACCESS_TOKEN}`,
    );
    if (!res.ok) {
      console.warn("[ig] 프로필 조회 실패", res.status, await res.text());
      return Response.json({ profile: null }, { status: 502 });
    }
    const p = (await res.json()) as Ig;
    return Response.json({
      profile: { name: p.name || p.username, handle: p.username, picture: p.profile_picture_url ?? "", followers: p.followers_count ?? 0 },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ profile: null }, { status: 503 });
  }
}
