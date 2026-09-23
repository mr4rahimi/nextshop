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
  needsRef: boolean;
  refLabel: string | null;
  needsPlatform: boolean;
  slaMinutes: number | null;
}

/** یک باربری قابل انتخاب — از `ShippingMethod`، نه از فهرست ثابت کد */
export interface CarrierOption {
  title: string;
  /** «۲ ساعت» — فقط نمایش، مهلت واقعی از `slaMinutes` نوع کار می‌آید */
  sla: string | null;
  feePayer: "COLLECT" | "PREPAID" | "FREE";
}

/** یک بازارگاه — از `StoreSettings.worklistPlatforms` */
export interface PlatformOption {
  key: string;
  label: string;
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
  supplierId: string | null;
  entity: string | null;
  entityId: string | null;
  linkUrl: string | null;
  /** BigInt سریالایز شده — رشته است نه عدد */
  amount: string | null;
  carrier: string | null;
  refNo: string | null;
  platform: string | null;
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
    refLabel: string | null;
    needsRef: boolean;
    needsPlatform: boolean;
    needsAmount: boolean;
    needsCarrier: boolean;
  };
  _count: { notes: number; referrals: number };
}

export interface TaskReferral {
  id: string;
  taskId: string;
  fromId: string | null;
  fromName: string;
  toId: string;
  toName: string;
  note: string | null;
  isUrgent: boolean;
  seenAt: string | null;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  roleTitle: string | null;
  isMe: boolean;
}

/** ارجاع فوریِ دیده‌نشده، همان‌طور که مسیر صندوق ورودی برمی‌گرداند */
export interface UrgentReferral {
  id: string;
  taskId: string;
  fromName: string;
  note: string | null;
  createdAt: string;
  task: {
    id: string;
    title: string;
    contactName: string | null;
    contactPhone: string | null;
  };
}

export interface InboxCounts {
  unseenReferrals: number;
  overdue: number;
  todayOpen: number;
  /** اعلان خوانده‌نشده‌ی سئو، محتوا و لینک‌سازی */
  marketing: number;
}

/** یک اعلان درون‌پنلی — سئو، محتوا یا لینک‌سازی */
export interface MarketingNotification {
  id: string;
  type: "SEO_TASK" | "CONTENT_TASK" | "LINK_NODE";
  entityId: string;
  title: string;
  body: string | null;
  url: string;
  createdAt: string;
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

/** یک روز از تقویم حضور — همان شکلی که مسیر حضور برمی‌گرداند */
export interface AttendanceDay {
  /** «1405-05-02» — کلید یکتای خانه‌ی تقویم و ورودیِ اصلاح دستی */
  key: string;
  day: string;
  jy: number;
  jm: number;
  jd: number;
  /** شنبه = ۰ */
  weekday: number;
  firstIn: string | null;
  lastOut: string | null;
  activeMin: number;
  grossMin: number;
  note: string | null;
  editedByName: string | null;
  editedAt: string | null;
  isFuture: boolean;
  /** دقیقه‌ی موظف طبق ساعت کاری — روز تعطیل صفر */
  expectedMin: number;
}

/** یک کارمند در فهرست صفحه‌ی حضور، با جمعِ همان ماه */
export interface AttendanceStaff {
  id: string;
  name: string;
  phone: string;
  isMe: boolean;
  workMode: string;
  activeMin: number;
  presentDays: number;
}

export interface AttendanceResponse {
  year: number;
  month: number;
  userId: string;
  days: AttendanceDay[];
  totals: { activeMin: number; presentDays: number; expectedMin: number; expectedToDateMin: number };
  /** حضوری / دورکار / ترکیبیِ کارمندِ نمایش‌داده‌شده */
  workMode: string;
  staff: AttendanceStaff[];
  capMin: number;
  can: { viewAll: boolean; edit: boolean; manageSettings: boolean };
}
