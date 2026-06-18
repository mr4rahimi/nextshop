// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export type FlowActionType = "categories" | "connect_context" | "reply" | "free_text";

export interface FlowAction {
  type: FlowActionType;
  contextTopic?: string;
  replyText?: string;
}

export interface FlowNode {
  id: string;
  label: string;
  message?: string;
  showOther?: boolean;
  action?: FlowAction;
  children: FlowNode[];
}

export const CONTEXT_TOPICS = [
  { value: "warranty", label: "گارانتی", desc: "از اطلاعات گارانتی پاسخ می‌دهد" },
  { value: "shipping", label: "ارسال و هزینه‌ها", desc: "روش‌ها و هزینه‌های ارسال" },
  { value: "contact", label: "راه‌های ارتباطی", desc: "تلفن، ایمیل و شبکه‌های اجتماعی" },
  { value: "address", label: "آدرس و ساعات کاری", desc: "آدرس و ساعت کار فروشگاه" },
  { value: "about", label: "درباره فروشگاه", desc: "اطلاعات کلی کسب‌وکار" },
] as const;

export const ACTION_TYPES: {
  value: FlowActionType;
  label: string;
  desc: string;
}[] = [
  {
    value: "categories",
    label: "نمایش دسته‌بندی محصولات",
    desc: "دسته‌بندی‌های سایت به‌صورت خودکار به‌شکل دکمه نشان داده می‌شوند",
  },
  {
    value: "connect_context",
    label: "اتصال به موضوع مشخص",
    desc: "سوال کاربر همراه با موضوع انتخابی به هوش مصنوعی می‌رود",
  },
  {
    value: "reply",
    label: "پاسخ ثابت (بدون هوش مصنوعی)",
    desc: "متنی که می‌نویسید مستقیم نمایش داده می‌شود — سریع و رایگان",
  },
  {
    value: "free_text",
    label: "سوال آزاد",
    desc: "ورودی متنی باز می‌شود و سوال آزاد به هوش مصنوعی می‌رود",
  },
];

let idCounter = 0;
export function newNodeId(): string {
  idCounter += 1;
  return `n_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function createNode(partial?: Partial<FlowNode>): FlowNode {
  return {
    id: newNodeId(),
    label: "",
    message: "",
    showOther: false,
    action: { type: "free_text" },
    children: [],
    ...partial,
  };
}

export function updateNodeById(
  nodes: FlowNode[],
  id: string,
  updater: (node: FlowNode) => FlowNode
): FlowNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (node.children.length) {
      return { ...node, children: updateNodeById(node.children, id, updater) };
    }
    return node;
  });
}

export function removeNodeById(nodes: FlowNode[], id: string): FlowNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.children.length
        ? { ...node, children: removeNodeById(node.children, id) }
        : node
    );
}

export function addChildToNode(
  nodes: FlowNode[],
  parentId: string,
  child: FlowNode
): FlowNode[] {
  return updateNodeById(nodes, parentId, (node) => ({
    ...node,
    children: [...node.children, child],
  }));
}

export function moveNodeInSiblings(
  nodes: FlowNode[],
  id: string,
  direction: -1 | 1
): FlowNode[] {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx !== -1) {
    const target = idx + direction;
    if (target < 0 || target >= nodes.length) return nodes;
    const copy = [...nodes];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    return copy;
  }
  return nodes.map((node) =>
    node.children.length
      ? { ...node, children: moveNodeInSiblings(node.children, id, direction) }
      : node
  );
}

export function getNodeIssues(node: FlowNode): string[] {
  const issues: string[] = [];
  if (!node.label.trim()) issues.push("متن دکمه خالی است");

  const isMenu = node.children.length > 0;
  if (!isMenu) {
    if (!node.action) {
      issues.push("رفتار دکمه مشخص نشده");
    } else {
      if (node.action.type === "connect_context" && !node.action.contextTopic) {
        issues.push("موضوع اتصال انتخاب نشده");
      }
      if (node.action.type === "reply" && !node.action.replyText?.trim()) {
        issues.push("متن پاسخ ثابت خالی است");
      }
    }
  }
  return issues;
}
