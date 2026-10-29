import { Suspense } from "react";
import { checkSupabaseConnection } from "@/lib/supabase/health";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-mono tracking-widest text-neutral-500 uppercase">
          Hackathon Starter
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">
          Next.js + Supabase 보일러플레이트
        </h1>
        <p className="text-neutral-500">
          주제가 공개되면 이 발사대 위에 핵심 기능 하나만 얹으면 됩니다.
        </p>
      </header>

      <Suspense fallback={<StatusSkeleton />}>
        <ConnectionStatus />
      </Suspense>
    </main>
  );
}

async function ConnectionStatus() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const envReady = hasUrl && hasAnonKey;

  const connection = envReady
    ? await checkSupabaseConnection()
    : { ok: false, message: "환경변수가 아직 설정되지 않았습니다." };

  return (
    <>
      <section className="flex flex-col gap-3">
        <StatusRow label="환경변수 (NEXT_PUBLIC_SUPABASE_URL)" ok={hasUrl} />
        <StatusRow
          label="환경변수 (NEXT_PUBLIC_SUPABASE_ANON_KEY)"
          ok={hasAnonKey}
        />
        <StatusRow
          label="Supabase 연결"
          ok={connection.ok}
          detail={connection.message}
        />
      </section>

      {!envReady && (
        <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
          <code className="font-mono">.env.local.example</code> 를{" "}
          <code className="font-mono">.env.local</code> 로 복사하고 Supabase
          키를 채운 뒤 dev 서버를 재시작하세요.
        </p>
      )}
    </>
  );
}

function StatusSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[52px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        />
      ))}
    </section>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {detail && <span className="text-xs text-neutral-500">{detail}</span>}
      </div>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          ok
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-neutral-100 text-neutral-400 dark:bg-neutral-900"
        }`}
        aria-label={ok ? "정상" : "미설정"}
      >
        {ok ? "✓" : "—"}
      </span>
    </div>
  );
}
