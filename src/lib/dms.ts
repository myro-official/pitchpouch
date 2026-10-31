import type { User } from "@supabase/supabase-js";
import type { Msg } from "./inbox";
import { createAdminClient as db } from "./supabase/admin";

// 실제 인스타 DM 저장소(supabase/migrations의 dms). 서버가 service role로만 읽고 쓴다.
// 읽음·처리 여부는 화면이 들고 있어서 저장하지 않는다.
export type DmData = Omit<Msg, "id" | "minutesAgo" | "read" | "done">;
type Row = { id: string; data: DmData; created_at: string };

// 연결된 인스타 계정이 하나라, 실제 DM은 서버가 app_metadata.dm_viewer를 켜 준 계정(테스트 계정, 팀원)만 본다.
// 새로 가입한 계정은 빈 보관함이다. app_metadata는 service role로만 바꿀 수 있다.
export const canViewDms = (user: User) => user.app_metadata?.dm_viewer === true;

// Meta가 같은 이벤트를 다시 보내도 메시지 id(mid)가 같아서 한 번만 들어간다.
export async function saveDm(id: string, data: DmData) {
  const { error } = await db().from("dms").upsert({ id, data }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`[dms] ${error.code} ${error.message}`);
}

export async function getDm(id: string) {
  const { data, error } = await db().from("dms").select("data, created_at").eq("id", id).maybeSingle<Omit<Row, "id">>();
  if (error) throw new Error(`[dms] ${error.code} ${error.message}`);
  return data ? { ...data.data, createdAt: data.created_at } : null;
}

export async function listDms(): Promise<Msg[]> {
  const { data, error } = await db().from("dms").select("id, data, created_at").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`[dms] ${error.code} ${error.message}`);
  return ((data ?? []) as Row[]).map((r) => ({
    ...r.data,
    id: r.id,
    minutesAgo: Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60000),
    read: false,
    done: false,
  }));
}
