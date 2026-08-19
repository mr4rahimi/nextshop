"use client";

import { use, useEffect, useState } from "react";
import PageForm, { EMPTY_PAGE, type PageFormValue } from "@/components/admin/pages/PageForm";
import { normalizePageBlocks, normalizeTemplate } from "@/lib/pages";

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<PageFormValue | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/pages/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(p => setInitial({
        id:             p.id,
        slug:           p.slug,
        title:          p.title,
        subtitle:       p.subtitle ?? "",
        template:       normalizeTemplate(p.template),
        contentHtml:    p.contentHtml ?? "",
        coverImage:     p.coverImage ?? "",
        blocks:         normalizePageBlocks(p.blocks),
        seoTitle:       p.seoTitle ?? "",
        seoDescription: p.seoDescription ?? "",
        isActive:       p.isActive,
        isIndexable:    p.isIndexable,
        showToc:        p.showToc,
        sortOrder:      p.sortOrder,
      }))
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) return <div className="p-10 text-center text-sm text-gray-400">برگه یافت نشد.</div>;
  if (!initial)  return <div className="p-10 text-center text-sm text-gray-400">در حال بارگذاری...</div>;

  return <PageForm initial={{ ...EMPTY_PAGE, ...initial }} mode="edit" />;
}
