import { Keyboard } from "grammy";
import type { Context } from "grammy";
import { bot } from "../bot.js";
import { startUserSession } from "../services/funnel.js";
import { trackLeadStart } from "../services/leads.js";

export async function handleStart(ctx: Context) {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const name = ctx.from?.first_name || ctx.from?.username || "there";

  if (!userId || !chatId) return;

  // Track lead details & timestamp
  trackLeadStart(
    userId,
    chatId,
    ctx.from?.first_name || "Unknown",
    ctx.from?.last_name,
    ctx.from?.username
  );

  // Initialize or reset session with abandonment reminder timer
  startUserSession(bot, userId, chatId, name, ctx.from?.username);

  // Message 1
  await ctx.reply(
    `Welcome ${name}, my name is Abhi and this is my automated bot, to see if you're qualified to join premium 😊`
  );

  // Short natural breathing delay so messages arrive sequentially
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Message 2 with Reply Keyboard at the message input (disappears once clicked)
  const keyboard = new Keyboard()
    .text("Yes, I'm ready! 🚀")
    .resized()
    .oneTime();

  await ctx.reply(
    "You ready to get started with me? It's going to take about 5 minutes of your time so do prepare!",
    {
      reply_markup: keyboard,
    }
  );
}
