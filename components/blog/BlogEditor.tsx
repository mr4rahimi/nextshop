"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { useEffect, useState } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

function ToolBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all ${active ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5" />;
}

export default function BlogEditor({ value, onChange, placeholder = "محتوای مطلب را بنویسید..." }: Props) {
  const [linkUrl, setLinkUrl] = useState("");
  const [imgUrl, setImgUrl]   = useState("");
  const [ytUrl, setYtUrl]     = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showImg, setShowImg]   = useState(false);
  const [showYt, setShowYt]     = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary-600 underline" } }),
      Image.configure({ HTMLAttributes: { class: "rounded-2xl max-w-full my-4" } }),
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { class: "rounded-2xl my-4 w-full" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none min-h-[400px] p-6 outline-none focus:outline-none text-right",
        dir: "rtl",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value]);

  if (!editor) return null;

  function addLink() {
    if (!linkUrl) return;
    editor?.chain().focus().setLink({ href: linkUrl }).run();
    setLinkUrl(""); setShowLink(false);
  }

  function addImage() {
    if (!imgUrl) return;
    editor?.chain().focus().setImage({ src: imgUrl }).run();
    setImgUrl(""); setShowImg(false);
  }

  function addYoutube() {
    if (!ytUrl) return;
    editor?.commands.setYoutubeVideo({ src: ytUrl });
    setYtUrl(""); setShowYt(false);
  }

  const inp = "border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 flex-1";

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
      {}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">

        {/* Headings */}
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })} title="عنوان H2">H2</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })} title="عنوان H3">H3</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          active={editor.isActive("heading", { level: 4 })} title="عنوان H4">H4</ToolBtn>
        <Divider />

        {}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")} title="Bold">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")} title="Italic">
          <em>I</em>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")} title="Underline">
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")} title="Strike">
          <span className="line-through">S</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")} title="Highlight">
          <span className="bg-yellow-200 px-0.5">H</span>
        </ToolBtn>
        <Divider />

        {}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")} title="Bullet List">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")} title="Ordered List">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")} title="Blockquote">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")} title="Code">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </ToolBtn>
        <Divider />

        {/* align */}
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })} title="راست">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 10h12M3 14h18M3 18h12" />
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })} title="وسط">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M6 10h12M3 14h18M6 18h12" />
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })} title="چپ">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 10h12M3 14h18M3 18h8" />
          </svg>
        </ToolBtn>
        <Divider />

        {}
        <ToolBtn onClick={() => { setShowLink(!showLink); setShowImg(false); setShowYt(false); }}
          active={showLink || editor.isActive("link")} title="لینک">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </ToolBtn>
        {editor.isActive("link") && (
          <ToolBtn onClick={() => editor.chain().focus().unsetLink().run()} title="حذف لینک">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </ToolBtn>
        )}

        {}
        <ToolBtn onClick={() => { setShowImg(!showImg); setShowLink(false); setShowYt(false); }}
          active={showImg} title="تصویر">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </ToolBtn>

        {}
        <ToolBtn onClick={() => { setShowYt(!showYt); setShowLink(false); setShowImg(false); }}
          active={showYt} title="ویدیو یوتیوب">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </ToolBtn>
        <Divider />

        {/* undo/redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </ToolBtn>
      </div>

      {}
      {showLink && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
          <input className={inp} dir="ltr" placeholder="https://example.com"
            value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addLink()} />
          <button type="button" onClick={addLink}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all">
            ثبت
          </button>
          <button type="button" onClick={() => setShowLink(false)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-all">
            لغو
          </button>
        </div>
      )}

      {}
      {showImg && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
          <input className={inp} dir="ltr" placeholder="آدرس تصویر https://..."
            value={imgUrl} onChange={e => setImgUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addImage()} />
          <button type="button" onClick={addImage}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all">
            افزودن
          </button>
          <button type="button" onClick={() => setShowImg(false)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-all">
            لغو
          </button>
        </div>
      )}

      {}
      {showYt && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
          <input className={inp} dir="ltr" placeholder="لینک ویدیو یوتیوب یا آپارات"
            value={ytUrl} onChange={e => setYtUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addYoutube()} />
          <button type="button" onClick={addYoutube}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all">
            درج
          </button>
          <button type="button" onClick={() => setShowYt(false)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-all">
            لغو
          </button>
        </div>
      )}

      {}
      <EditorContent editor={editor} />
    </div>
  );
}
