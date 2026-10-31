import { extractForm } from "@/lib/extract";

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text?: string };
  const body = text?.trim() ?? "";
  if (body.length < 10) return Response.json({ error: "제안 문구를 조금 더 붙여넣어 주세요." }, { status: 400 });
  return Response.json({ draft: await extractForm(body.slice(0, 8000)) });
}
