/**
 * شکل داده‌ی سمت کلاینت لینک‌سازی — همان خروجی `toNodeDto` و سرویس‌ها بعد
 * از `serialize` (تاریخ رشته می‌شود، BigInt عدد).
 */

import type {
  LinkAnchorKind,
  LinkCampaignStatus,
  LinkContentKind,
  LinkNodeStatus,
} from "@/lib/marketing/link-constants";
import type { ContentTaskStatus, MarketingEventAction } from "@prisma/client";

export interface StaffOption {
  id: string;
  name: string;
  isMe: boolean;
}

export interface PlatformDto {
  id: string;
  title: string;
  domain: string;
  accountNote: string | null;
  iconPath: string | null;
  domainAuthority: number | null;
  isActive: boolean;
}

export interface LinkTypeDto {
  id: string;
  key: string | null;
  title: string;
  icon: string | null;
  description: string | null;
  seoNote: string | null;
  sampleSites: string | null;
  defaultContentKind: LinkContentKind;
  defaultFollow: boolean;
  defaultUgc: boolean;
  defaultSponsored: boolean;
  isRisky: boolean;
  isActive: boolean;
  nodeCount: number;
  platforms: PlatformDto[];
}

export interface LinkMeta {
  types: LinkTypeDto[];
  linkStaff: StaffOption[];
  contentStaff: StaffOption[];
  can: { manage: boolean; work: boolean; viewAll: boolean; settings: boolean };
  me: { id: string; name: string };
}

export interface TargetDto {
  id: string;
  url: string;
  label: string | null;
  primaryKeyword: string | null;
  isActive: boolean;
}

export interface CampaignListItem {
  id: string;
  title: string;
  note: string | null;
  status: LinkCampaignStatus;
  weeklyQuota: number | null;
  targets: TargetDto[];
  nodeCount: number;
  liveCount: number;
  updatedAt: string;
}

export interface CampaignDetail {
  id: string;
  title: string;
  note: string | null;
  status: LinkCampaignStatus;
  weeklyQuota: number | null;
  anchorProfile: string;
  targets: TargetDto[];
  warnings: { orphans: number; noDestination: number; tooDeep: number; maxTier: number };
}

export interface ContentStateDto {
  taskId: string;
  code: number;
  status: ContentTaskStatus;
  title: string;
  isReady: boolean;
}

export interface LinkNodeDto {
  id: string;
  code: number;
  campaignId: string;
  campaign: { id: string; title: string };
  tier: number | null;
  status: LinkNodeStatus;
  type: { id: string; title: string; icon: string | null; isRisky: boolean };
  platform: { id: string; title: string; domain: string; iconPath: string | null } | null;
  anchorText: string | null;
  anchorKind: LinkAnchorKind | null;
  relFollow: boolean;
  relUgc: boolean;
  relSponsored: boolean;
  contentKind: LinkContentKind;
  wordCount: number | null;
  contentBrief: string | null;
  profileTitle: string | null;
  contentTaskId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdByName: string | null;
  dueAt: string | null;
  publishedUrl: string | null;
  cost: number | null;
  note: string | null;
  returnCount: number;
  returnReason: string | null;
  failReason: string | null;
  liveAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  destinations: { toNodeId: string | null; toTargetId: string | null }[];
  isBlocked: boolean;
  content: ContentStateDto | null;
}

export interface NodeEventDto {
  id: string;
  actorName: string | null;
  action: MarketingEventAction;
  note: string | null;
  createdAt: string;
}

export interface AnchorSliceDto {
  kind: LinkAnchorKind | "UNSET";
  count: number;
  percent: number;
  range: [number, number] | null;
  verdict: "ok" | "high" | "low" | "none";
}

export interface CampaignStatsDto {
  total: number;
  byStatus: { status: LinkNodeStatus; count: number }[];
  byTier: { tier: number | null; count: number }[];
  byType: { id: string; title: string; count: number }[];
  follow: { follow: number; nofollow: number; ugc: number; sponsored: number };
  anchors: AnchorSliceDto[];
  perTarget: { id: string; label: string; url: string; total: number; anchors: AnchorSliceDto[] }[];
  totalCost: number;
  progressPercent: number;
  anchorProfile: string;
  nodes: { id: string; anchorKind: LinkAnchorKind | null; targetIds: string[] }[];
}

export interface CanvasNode {
  id: string;
  code: number;
  tier: number | null;
  status: LinkNodeStatus;
  posX: number;
  posY: number;
  anchorText: string | null;
  relFollow: boolean;
  assigneeName: string | null;
  type: { id: string; title: string; icon: string | null; isRisky: boolean };
  platform: { id: string; title: string; iconPath: string | null } | null;
}

export interface CanvasTarget {
  id: string;
  url: string;
  label: string | null;
  primaryKeyword: string | null;
  posX: number;
  posY: number;
}

export interface CanvasData {
  nodes: CanvasNode[];
  targets: CanvasTarget[];
  edges: { id: string; fromNodeId: string; toNodeId: string | null; toTargetId: string | null }[];
  isPristine: boolean;
}
