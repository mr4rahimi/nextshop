"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageForm, { EMPTY_PAGE, type PageFormValue } from "@/components/admin/pages/PageForm";
import { normalizePageBlocks, normalizeTemplate } from "@/lib/pages";
import { PAGE_STARTERS } from "@/lib/pageStarters";

function CreatePageInner() {
  const starterKey = useSearchParams().get("starter");
  const starter = PAGE_STARTERS.find(s => s.key === starterKey);

  const initial: PageFormValue = starter
    ? {
        ...EMPTY_PAGE,
        slug:        starter.slug,
        title:       starter.title,
        subtitle:    starter.subtitle,
        template:    normalizeTemplate(starter.template),
        contentHtml: starter.contentHtml,
        showToc:     starter.showToc ?? false,
        blocks:      normalizePageBlocks(starter.blocks ?? null),
      }
    : EMPTY_PAGE;

  // key: اگر ادمین از یک قالب آماده به قالب دیگری برود، فرم باید از نو ساخته شود
  return <PageForm key={starterKey ?? "blank"} initial={initial} mode="create" />;
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-gray-400">در حال بارگذاری...</div>}>
      <CreatePageInner />
    </Suspense>
  );
}
