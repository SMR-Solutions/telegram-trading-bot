import { Bot, InlineKeyboard, InputFile } from "grammy";
import path from "node:path";
import fs from "node:fs";
import { updateLeadProgress, sendLeadAlert } from "./leads.js";

export type FunnelState = 
  | "AWAITING_READY"
  | "AWAITING_SOURCE"
  | "AWAITING_COMMITMENT"
  | "AWAITING_LIVESTREAMS"
  | "AWAITING_FUNDS"
  | "QUALIFIED"
  | "NOT_QUALIFIED"
  | "ABANDONED";

export interface UserSession {
  state: FunnelState;
  name: string;
  username?: string;
  chatId: number;
  reminderTimeout?: NodeJS.Timeout;
  source?: string;
  willingToCommit?: boolean;
  livestreams?: string;
  hasFunds?: boolean;
}

const sessions = new Map<number, UserSession>();

// Reminder delay: 2.5 minutes (between 2-3 mins), customizable via env
const REMINDER_DELAY_MS = process.env.REMINDER_DELAY_MS 
  ? Number(process.env.REMINDER_DELAY_MS) 
  : 2.5 * 60 * 1000;

export function getSession(userId: number): UserSession | undefined {
  return sessions.get(userId);
}

export function updateSession(userId: number, updates: Partial<UserSession>) {
  const session = sessions.get(userId);
  if (session) {
    Object.assign(session, updates);
  }
}

export function isSessionAbandoned(userId: number): boolean {
  const session = sessions.get(userId);
  return session?.state === "ABANDONED";
}

export function clearAbandonmentReminder(userId: number) {
  const session = sessions.get(userId);
  if (session?.reminderTimeout) {
    clearTimeout(session.reminderTimeout);
    session.reminderTimeout = undefined;
  }
}

/**
 * Schedules an abandonment reminder if the user does not take action
 * while remaining in the expectedState for REMINDER_DELAY_MS (2-3 mins).
 */
export function scheduleStepReminder(
  bot: Bot, 
  userId: number, 
  expectedState: FunnelState,
  chatId?: number,
  name?: string
) {
  clearAbandonmentReminder(userId);

  let session = sessions.get(userId);
  if (!session) {
    session = {
      state: expectedState,
      name: name || "there",
      chatId: chatId || userId,
    };
    sessions.set(userId, session);
  } else {
    session.state = expectedState;
    if (chatId) session.chatId = chatId;
    if (name) session.name = name;
  }

  session.reminderTimeout = setTimeout(async () => {
    const current = sessions.get(userId);
    if (current && current.state === expectedState) {
      await sendAbandonmentReminder(bot, current.chatId, current.name, userId);
    }
  }, REMINDER_DELAY_MS);
}

export function startUserSession(bot: Bot, userId: number, chatId: number, name: string, username?: string) {
  clearAbandonmentReminder(userId);

  sessions.set(userId, {
    state: "AWAITING_READY",
    name,
    username,
    chatId,
  });

  scheduleStepReminder(bot, userId, "AWAITING_READY", chatId, name);
}

/**
 * Sends abandonment reminder, clears the bottom input keyboard so user cannot continue the quiz,
 * marks state as ABANDONED, and alerts Admin with exact drop-off point.
 */
export async function sendAbandonmentReminder(bot: Bot, chatId: number, name: string, userId?: number) {
  if (userId) {
    const session = sessions.get(userId);
    let dropOffPoint = "Unknown step";

    if (session) {
      switch (session.state) {
        case "AWAITING_READY":
          dropOffPoint = "Step 1: Welcome / Start (Did not click 'Yes, I\\'m ready!')";
          break;
        case "AWAITING_SOURCE":
          dropOffPoint = "Step 2: Traffic Source (Did not pick Social Media / Streams / Friends / Others)";
          break;
        case "AWAITING_COMMITMENT":
          dropOffPoint = "Step 3: Long-Term Commitment (Did not pick YES / NO for 6-24 months)";
          break;
        case "AWAITING_LIVESTREAMS":
          dropOffPoint = "Step 4: Livestreams Count (Did not pick stream attendance)";
          break;
        case "AWAITING_FUNDS":
          dropOffPoint = "Step 5: 700 USD Question (Did not answer capital requirement)";
          break;
        default:
          dropOffPoint = session.state;
      }
      session.state = "ABANDONED";
    }

    // Update lead tracking & notify admin
    updateLeadProgress(userId, {
      status: "ABANDONED",
      dropOffPoint,
    });

    await sendLeadAlert(bot, userId, "ABANDONED");
  }

  const logoPath = path.resolve(process.cwd(), "assets", "tgp_logo.jpg");

  const messagePart1 = 
`Hey ${name}, if you don't know how to use this telegram bot or haven't completed your application, and still want all the benefits of premium....`;

  const messagePart2 = "Feel free to ask me questions personally below!";
  const keyboard = new InlineKeyboard().url("My personal Number  : )", "https://t.me/TGPtraders");

  try {
    // 1. Send logo photo first and remove the reply keyboard from the message input bar
    if (fs.existsSync(logoPath)) {
      await bot.api.sendPhoto(chatId, new InputFile(logoPath), {
        reply_markup: { remove_keyboard: true },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2. Message sent after the logo image
    await bot.api.sendMessage(chatId, messagePart1, {
      reply_markup: fs.existsSync(logoPath) ? undefined : { remove_keyboard: true },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // 3. Feel free to ask... with personal number button
    await bot.api.sendMessage(chatId, messagePart2, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error(`Failed to send abandonment reminder to chat ${chatId}:`, error);
  }
}

export async function sendAbandonedNotice(bot: Bot, chatId: number) {
  const keyboard = new InlineKeyboard().url("My personal Number  : )", "https://t.me/TGPtraders");
  await bot.api.sendMessage(
    chatId,
    "Your application was paused due to inactivity.\n\nFeel free to ask me questions personally below:",
    {
      reply_markup: keyboard,
    }
  );
}
