/**
 * افزونه‌های اختصاصی ادیتور مقاله/صفحه (BlogEditor).
 *
 * هر چیزی که اینجا ساخته می‌شود باید با HTML ساده و بدون جاوااسکریپت در
 * سایت هم درست دیده شود — صفحه‌ی مقاله فقط HTML ذخیره‌شده را رندر می‌کند و
 * استایلش در `app/styles/rich-content.css` است.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TableCell, TableHeader } from "@tiptap/extension-table";

export type CalloutType = "info" | "tip" | "warning" | "danger" | "note";

export const CALLOUTS: { type: CalloutType; label: string; emoji: string }[] = [
  { type: "info",    label: "اطلاعات", emoji: "ℹ️" },
  { type: "tip",     label: "نکته",    emoji: "💡" },
  { type: "warning", label: "هشدار",   emoji: "⚠️" },
  { type: "danger",  label: "خطر",     emoji: "⛔" },
  { type: "note",    label: "یادداشت", emoji: "📝" },
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** دور بلوک فعلی کادر می‌کشد؛ اگر داخل کادر باشد نوعش را عوض یا کادر را برمی‌دارد */
      toggleCallout: (type: CalloutType) => ReturnType;
    };
    videoEmbed: {
      setVideoEmbed: (src: string) => ReturnType;
    };
  }
}

/** کادر رنگی «نکته / هشدار / اطلاعات» — `<div data-callout="tip">` */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: el => el.getAttribute("data-callout") || "info",
        renderHTML: attrs => ({ "data-callout": attrs.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "callout" }), 0];
  },

  addCommands() {
    return {
      toggleCallout: type => ({ editor, commands }) => {
        if (editor.isActive(this.name)) {
          if (editor.getAttributes(this.name).type === type) return commands.lift(this.name);
          return commands.updateAttributes(this.name, { type });
        }
        return commands.wrapIn(this.name, { type });
      },
    };
  },
});

/**
 * لینک یوتیوب/آپارات را به آدرس embed تبدیل می‌کند؛ لینک ناشناخته null.
 * یوتیوب از دامنه‌ی nocookie پخش می‌شود تا کوکی ردیابی پیش از پخش ننشیند.
 */
export function toEmbedUrl(raw: string): string | null {
  const url = raw.trim();
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const ap = url.match(/aparat\.com\/(?:v\/|video\/video\/embed\/videohash\/)([\w-]+)/i);
  if (ap) return `https://www.aparat.com/video/video/embed/videohash/${ap[1]}/vt/frame`;
  return null;
}

/** ویدیوی یوتیوب یا آپارات — `<div data-video-embed><iframe/></div>` */
export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: el => el.querySelector("iframe")?.getAttribute("src") ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-video-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-video-embed": "", class: "video-embed" },
      ["iframe", {
        src: HTMLAttributes.src,
        allowfullscreen: "true",
        loading: "lazy",
        frameborder: "0",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
      }],
    ];
  },

  addCommands() {
    return {
      setVideoEmbed: src => ({ commands }) => commands.insertContent({ type: this.name, attrs: { src } }),
    };
  },
});

/**
 * تصویر با عرض درصدی و چینش — alt و title از خود افزونه‌ی Image می‌آیند.
 * عرض با style نوشته می‌شود تا در سایت بدون کلاس اضافه کار کند.
 */
export const RichImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.style.width || el.getAttribute("data-width") || null,
        renderHTML: attrs => (attrs.width ? { style: `width:${attrs.width}`, "data-width": attrs.width } : {}),
      },
      align: {
        default: null,
        parseHTML: el => el.getAttribute("data-align"),
        renderHTML: attrs => (attrs.align ? { "data-align": attrs.align } : {}),
      },
    };
  },
});

/** رنگ پس‌زمینه‌ی خانه‌ی جدول — برای برجسته کردن ستون/ردیف در جدول مقایسه */
const backgroundAttr = {
  background: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute("data-bg") || el.style.backgroundColor || null,
    renderHTML: (attrs: Record<string, any>) =>
      attrs.background ? { "data-bg": attrs.background, style: `background-color:${attrs.background}` } : {},
  },
};

export const RichTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundAttr };
  },
});

export const RichTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundAttr };
  },
});
