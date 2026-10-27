// Shared client-side types for the DeepRest UI

export interface RankInfo {
  level: number;
  name: string;
  minXp: number;
  icon: string;
  color: string;
  colorEnd: string;
  tagline: string;
}

export interface RankBlock {
  current: RankInfo;
  next: RankInfo | null;
  progressPercent: number;
  xpToNext?: number;
}

export interface PublicUser {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarImage: string | null;
  avatarEmoji: string | null;
  bio: string | null;
  totalPoints: number;
  streak: number;
  memberSince: string;
  rank: RankBlock;
  isMe?: boolean;
  isCreator?: boolean;
}

export interface MeResponse {
  user: {
    id: string;
    name: string;
    username: string;
    avatarColor: string;
    avatarImage: string | null;
    avatarEmoji: string | null;
    bio: string | null;
    totalPoints: number;
    streak: number;
    memberSince?: string;
  };
  settings: { dailyTargetMin: number };
  today: {
    date: string;
    minutesUsed: number;
    targetMin: number;
    metTarget: boolean;
    topApps: { name: string; minutes: number }[];
  };
  rank: {
    current: RankInfo;
    next: RankInfo | null;
    progressPercent: number;
    potentialTodayXp: number;
  };
  history: { date: string; minutesUsed: number; targetMin: number; metTarget: boolean }[];
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export interface DuoResponse {
  partnership: { id: string; since: string } | null;
  pendingInvite: { id: string; inviteCode: string; isInitiator: boolean } | null;
  partner?: {
    id: string;
    name: string;
    avatarColor: string;
    streak: number;
    totalPoints: number;
    today: {
      minutesUsed: number;
      targetMin: number;
      metTarget: boolean;
      topApps: { name: string; minutes: number }[];
    };
  };
  me?: { today: { minutesUsed: number; targetMin: number } };
}

export interface SosResponse {
  sent: { id: string; message: string; status: string; createdAt: string }[];
  received: { id: string; message: string; createdAt: string }[];
}

export interface CallState {
  id: string;
  status: "RINGING" | "ACTIVE" | "ENDED" | "DECLINED" | "MISSED";
  modality: "voice" | "video";
  isCaller: boolean;
  peerName: string;
  peerColor: string;
  startedAt: string;
  answeredAt: string | null;
}

// ---------- Community (DMs & groups) ----------

export interface ConversationListItem {
  id: string;
  kind: "dm" | "group";
  name: string;
  emoji: string | null;
  updatedAt: string;
  unreadCount: number;
  memberCount: number;
  lastMessage: { body: string; kind: string; createdAt: string; senderId: string; senderName: string } | null;
  peer?: { id: string; name: string; avatarColor: string; avatarImage: string | null; avatarEmoji: string | null; bio: string | null; rank: RankBlock };
  members?: PublicUser[];
}

export interface CommunityMessage {
  id: string;
  body: string;
  kind: "text" | "system";
  createdAt: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  senderImage: string | null;
  senderEmoji: string | null;
  mine: boolean;
}

export type ViewId = "dashboard" | "companions" | "community" | "duo" | "ranks" | "profile";
