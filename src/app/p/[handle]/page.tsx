import { Suspense } from "react";
import { BrandForm } from "@/components/BrandForm";

export default function ProposePage(props: PageProps<"/p/[handle]">) {
  return (
    <Suspense fallback={<div className="app" />}>
      <Form params={props.params} />
    </Suspense>
  );
}

async function Form({ params }: { params: PageProps<"/p/[handle]">["params"] }) {
  const { handle } = await params;
  return <BrandForm handle={decodeURIComponent(handle)} />;
}
