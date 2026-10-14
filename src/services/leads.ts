import { Bot } from "grammy";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export type LeadStatus = "IN_PROGRESS" | "QUALIFIED" | "DISQUALIFIED" | "ABANDONED";

export interface LeadData {
  userId: number;
  chatId: number;
  firstName: string;
  lastName?: string;
  fullName: string;
  username?: string;
  startedAt: string;
  lastActiveAt: string;
  status: LeadStatus;
  lastStepReached: string;
  dropOffPoint?: string;
  source?: string;
  willingToCommit?: boolean;
  livestreams?: string;
  hasFunds?: boolean;
}

const leadsFilePath = path.resolve(process.cwd(), "data", "leads.json");

// Ensure data directory exists
function ensureDataDir() {
  const dir = path.dirname(leadsFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// In-memory cache of leads
const leads = new Map<number, LeadData>();

// Load existing leads from disk on startup
export function loadLeadsFromDisk() {
  ensureDataDir();
  if (fs.existsSync(leadsFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(leadsFilePath, "utf8"));
      if (Array.isArray(data)) {
        for (const item of data) {
          leads.set(item.userId, item);
        }
      }
    } catch (err) {
      console.error("Failed to read leads.json:", err);
    }
  }
}

// Save all leads to disk
export function saveLeadsToDisk() {
  ensureDataDir();
  try {
    const list = Array.from(leads.values());
    fs.writeFileSync(leadsFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write leads.json:", err);
  }
}

export function formatDateTime(date: Date = new Date()): string {
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata", // Standard IST time for owner
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " (IST)";
}

export function trackLeadStart(
  userId: number,
  chatId: number,
  firstName: string,
  lastName?: string,
  username?: string
): LeadData {
  const now = formatDateTime();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

  const lead: LeadData = {
    userId,
    chatId,
    firstName,
    lastName,
    fullName,
    username,
    startedAt: now,
    lastActiveAt: now,
    status: "IN_PROGRESS",
    lastStepReached: "Clicked /start (Ready Question)",
  };

  leads.set(userId, lead);
  saveLeadsToDisk();
  return lead;
}

export function updateLeadProgress(userId: number, updates: Partial<LeadData>): LeadData | undefined {
  const lead = leads.get(userId);
  if (!lead) return undefined;

  Object.assign(lead, updates, {
    lastActiveAt: formatDateTime(),
  });

  saveLeadsToDisk();
  return lead;
}

/**
 * Sends a rich Telegram notification to the Admin with full lead details
 */
export async function sendLeadAlert(
  bot: Bot,
  userId: number,
  event: "QUALIFIED" | "DISQUALIFIED" | "ABANDONED"
) {
  if (!config.adminId) {
    console.warn("ADMIN_ID is not configured in .env. Cannot deliver lead notification.");
    return;
  }

  const lead = leads.get(userId);
  if (!lead) return;

  const userLink = lead.username 
    ? `https://t.me/${lead.username}` 
    : `tg://user?id=${lead.userId}`;

  let header = "";
  let statusEmoji = "";
  let dropOffSection = "";

  if (event === "QUALIFIED") {
    header = "🎯 <b>NEW QUALIFIED LEAD (1% CLUB)!</b> 🎯";
    statusEmoji = "✅ <b>Qualified for Premium</b>";
  } else if (event === "DISQUALIFIED") {
    header = "⚠️ <b>LEAD DISQUALIFIED</b> ⚠️";
    statusEmoji = "❌ <b>Did Not Qualify</b>";
    dropOffSection = `\n🛑 <b>Reason:</b> ${lead.dropOffPoint || "Did not meet criteria"}`;
  } else if (event === "ABANDONED") {
    header = "⏸️ <b>LEAD DROPPED OFF (INACTIVE)</b> ⏸️";
    statusEmoji = "⏳ <b>Stopped Responding (Inactivity)</b>";
    dropOffSection = `\n🛑 <b>Left At:</b> ${lead.dropOffPoint || lead.lastStepReached}\n⚠️ <i>Follow-up reminder card has been sent to user.</i>`;
  }

  const commitmentText = lead.willingToCommit === undefined 
    ? "⏳ Not answered" 
    : lead.willingToCommit ? "✅ Yes (6-24 months)" : "❌ No";

  const fundsText = lead.hasFunds === undefined 
    ? "⏳ Not answered" 
    : lead.hasFunds ? "✅ Yes (700+ USD ready)" : "❌ No";

  const message = 
`${header}

👤 <b>Name:</b> ${escapeHtml(lead.fullName)}
📱 <b>Username:</b> ${lead.username ? `@${lead.username}` : "<i>No username</i>"}
🔗 <b>Profile Link:</b> <a href="${userLink}">${lead.username ? `@${lead.username}` : "Open Profile"}</a>
🆔 <b>User ID:</b> <code>${lead.userId}</code>

⏰ <b>Started At:</b> ${lead.startedAt}
⏱️ <b>Last Active:</b> ${lead.lastActiveAt}

📍 <b>Current Status:</b> ${statusEmoji}${dropOffSection}

📋 <b>Funnel Details:</b>
• <b>Traffic Source:</b> ${lead.source ? escapeHtml(lead.source) : "⏳ Not chosen"}
• <b>Long-Term Commitment:</b> ${commitmentText}
• <b>Livestreams Attended:</b> ${lead.livestreams ? escapeHtml(lead.livestreams) : "⏳ Not reached"}
• <b>700 USD Ready:</b> ${fundsText}
`;

  try {
    await bot.api.sendMessage(config.adminId, message, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
    console.log(`✅ Lead alert [${event}] sent to admin for user ${lead.userId}`);
  } catch (error) {
    console.error(`Failed to send lead alert to admin (${config.adminId}):`, error);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
