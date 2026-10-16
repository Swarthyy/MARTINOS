export type Mode = "life" | "ceo";
export type Method = "official_api" | "browser_handoff" | "import" | "research";

export type Integration = {
  key: string;
  name: string;
  mode: Mode;
  method: Method;
  description: string;
};

export const integrations: Integration[] = [
  { key: "latitude", name: "Latitude", mode: "life", method: "import", description: "Credit card statements and obligations" },
  { key: "up", name: "Up Bank", mode: "life", method: "official_api", description: "Balances and transactions" },
  { key: "hevy", name: "Hevy", mode: "life", method: "research", description: "Training history and progression" },
  { key: "calories", name: "Calorie exports", mode: "life", method: "import", description: "Structured nutrition history" },
  { key: "oura", name: "Oura", mode: "life", method: "official_api", description: "Sleep and recovery" },
  { key: "calendar", name: "Google Calendar", mode: "life", method: "official_api", description: "Events and commitments" },
  { key: "ticktick", name: "TickTick", mode: "life", method: "research", description: "Tasks and routines" },
  { key: "skool", name: "Skool", mode: "ceo", method: "research", description: "Community and revenue" },
  { key: "instagram", name: "Instagram", mode: "ceo", method: "official_api", description: "Audience and content insights" },
  { key: "youtube", name: "YouTube", mode: "ceo", method: "official_api", description: "Channel analytics" },
  { key: "gmail", name: "Gmail", mode: "ceo", method: "official_api", description: "Messages and drafts" },
  { key: "calendly", name: "Calendly", mode: "ceo", method: "official_api", description: "Bookings" },
  { key: "tiktok", name: "TikTok", mode: "ceo", method: "research", description: "Audience analytics" },
  { key: "x", name: "X", mode: "ceo", method: "research", description: "Post analytics" },
  { key: "notion", name: "Notion", mode: "ceo", method: "official_api", description: "Knowledge and plans" },
  { key: "drive", name: "Google Drive", mode: "ceo", method: "official_api", description: "Documents and records" },
  { key: "github", name: "GitHub", mode: "ceo", method: "official_api", description: "Development activity" }
];

export type Connection = {
  integration_key: string;
  status: "connected" | "imported" | "attention" | "paused";
  last_success_at: string | null;
  last_error: string | null;
  source_method: Method;
};

export function freshness(lastSuccess: string | null): string {
  if (!lastSuccess) return "Never synced";
  const date = new Date(lastSuccess);
  if (Number.isNaN(date.getTime())) return "Unknown freshness";
  const hours = Math.floor((Date.now() - date.getTime()) / 3_600_000);
  if (hours < 1) return "Updated within an hour";
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}
