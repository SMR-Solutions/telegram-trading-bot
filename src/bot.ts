import { Bot } from "grammy";
import { config } from "./config.js";

export const bot = new Bot(config.botToken);

// Error handler so the bot doesn't crash on unhandled errors
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  console.error(err.error);
});
