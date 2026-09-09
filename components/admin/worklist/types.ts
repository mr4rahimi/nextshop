/** تایپ‌های مشترک کامپوننت‌های کارتابل — همان شکلی که API برمی‌گرداند */

import type {
  StaffDomain,
  StaffChannel,
  StaffTaskSource,
  StaffTaskStatus,
  StaffPriority,
} from "@/lib/worklist/types";

export interface TaskTypeLite {
  id: string;
  slug: string;
  title: string;
  domain: StaffDomain;
  channel: StaffChannel;
  source: StaffTaskSource;
  icon: string | null;
  outcomes: unknown;
  needsCustomer: boolean;
  needsAmount: boolean;
  needsLink: boolean;
  needsCarrier: boolean;
  slaMinutes: number | null;
}

export interface TaskItem {
  id: string;
  typeId: string;
  domain: StaffDomain;
  channel: StaffChannel;
  source: StaffTaskSource;
  title: string;
  ownerId: string | null;
  ownerName: string;
  createdById: string | null;
  createdByName: string;
  status: StaffTaskStatus;
  priority: StaffPriority;
  customerId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  supplierName: string | null;
  entity: string | null;
  entityId: string | null;
  linkUrl: string | null;
  /** BigInt سریالایز شده — رشته است نه عدد */
  amount: string | null;
  carrier: string | null;
  outcome: string | null;
  note: string | null;
  parentId: string | null;
  ruleId: string | null;
  dueAt: string | null;
  occurredAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
  type: {
    id: string;
    slug: string;
    title: string;
    icon: string | null;
    outcomes: unknown;
  };
  _count: { notes: number };
}

export interface TaskNote {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface ContactSuggestion {
  id: string;
  name: string;
  phone: string;
  isClubMember: boolean;
  orderCount: number;
  lastPurchaseAt: string | null;
}

export interface WorklistCounts {
  today: number;
  overdue: number;
  upcoming: number;
  unlogged: number;
  doneToday: number;
}
