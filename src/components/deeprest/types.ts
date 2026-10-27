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

export interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    avatarColor: string;
    totalPoints: number;
    streak: number;
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

export type ViewId = "dashboard" | "companions" | "duo";
