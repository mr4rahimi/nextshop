"use client";

import { useEffect, useMemo, useState } from "react";

type AttributeValue = {
  id: string;
  value: string;
  slug?: string | null;
  sortOrder: number;
};

type Attribute = {
  id: string;
  title: string;
  slug: string;
  isFilterable: boolean;
  sortOrder: number;
  values: AttributeValue[];
};

type AttributeGroup = {
  id: string;
  title: string;
  isActive: boolean;
  sortOrder: number;
  attributes: Attribute[];
};

export default function AttributeGroupsPage() {
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedAttribute, setSelectedAttribute] = useState<string>("");

  const [groupTitle, setGroupTitle] = useState("");
  const [attributeTitle, setAttributeTitle] = useState("");
  const [attributeSlug, setAttributeSlug] = useState("");
  const [valueTitle, setValueTitle] = useState("");
  const [valueSlug, setValueSlug] = useState("");

  async function load() {
    const res = await fetch("/api/admin/attribute-groups");
    const data = await res.json();
    setGroups(data);

    if (data.length && !selectedGroup) {
      setSelectedGroup(data[0].id);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroup),
    [groups, selectedGroup]
  );

  const currentAttribute = useMemo(
    () => currentGroup?.attributes?.find((a) => a.id === selectedAttribute),
    [currentGroup, selectedAttribute]
  );

  async function createGroup() {
    if (!groupTitle.trim()) return;

    await fetch("/api/admin/attribute-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: groupTitle }),
    });

    setGroupTitle("");
    load();
  }

  async function createAttribute() {
    if (!selectedGroup || !attributeTitle.trim()) return;

    await fetch("/api/admin/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: selectedGroup,
        title: attributeTitle,
        slug: attributeSlug,
        isFilterable: true,
      }),
    });

    setAttributeTitle("");
    setAttributeSlug("");
    load();
  }

  async function createValue() {
    if (!selectedAttribute || !valueTitle.trim()) return;

    await fetch("/api/admin/attribute-values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attributeId: selectedAttribute,
        value: valueTitle,
        slug: valueSlug,
      }),
    });

    setValueTitle("");
    setValueSlug("");
    load();
  }

  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-black mb-6">مدیریت ویژگی‌ها</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="border rounded-2xl p-4">
          <h2 className="font-black mb-4">گروه‌ها</h2>

          <div className="flex gap-2 mb-4">
            <input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              className="border rounded-xl px-3 py-2 flex-1"
              placeholder="عنوان گروه"
            />
            <button onClick={createGroup} className="px-4 py-2 bg-blue-600 text-white rounded-xl">
              +
            </button>
          </div>

          <div className="space-y-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedGroup(g.id);
                  setSelectedAttribute("");
                }}
                className={`w-full text-right p-3 rounded-xl border ${
                  selectedGroup === g.id ? "border-blue-500" : ""
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        </div>

        <div className="border rounded-2xl p-4">
          <h2 className="font-black mb-4">ویژگی‌ها</h2>

          {currentGroup && (
            <>
              <div className="space-y-2 mb-4">
                <input value={attributeTitle} onChange={(e)=>setAttributeTitle(e.target.value)} placeholder="عنوان ویژگی" className="border rounded-xl px-3 py-2 w-full"/>
                <input value={attributeSlug} onChange={(e)=>setAttributeSlug(e.target.value)} placeholder="slug" className="border rounded-xl px-3 py-2 w-full"/>
                <button onClick={createAttribute} className="w-full bg-blue-600 text-white py-2 rounded-xl">افزودن ویژگی</button>
              </div>

              <div className="space-y-2">
                {currentGroup.attributes?.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAttribute(a.id)}
                    className={`w-full text-right p-3 rounded-xl border ${
                      selectedAttribute === a.id ? "border-blue-500" : ""
                    }`}
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border rounded-2xl p-4">
          <h2 className="font-black mb-4">مقادیر</h2>

          {currentAttribute && (
            <>
              <div className="space-y-2 mb-4">
                <input value={valueTitle} onChange={(e)=>setValueTitle(e.target.value)} placeholder="مقدار" className="border rounded-xl px-3 py-2 w-full"/>
                <input value={valueSlug} onChange={(e)=>setValueSlug(e.target.value)} placeholder="slug" className="border rounded-xl px-3 py-2 w-full"/>
                <button onClick={createValue} className="w-full bg-blue-600 text-white py-2 rounded-xl">افزودن مقدار</button>
              </div>

              <div className="space-y-2">
                {currentAttribute.values?.map((v) => (
                  <div key={v.id} className="p-3 border rounded-xl">
                    {v.value}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
