import { Suspense } from "react";
import { BrandStatus } from "@/components/BrandStatus";

export default function StatusPage(props: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<div className="app" />}>
      <Status params={props.params} />
    </Suspense>
  );
}

async function Status({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  return <BrandStatus id={id} />;
}
