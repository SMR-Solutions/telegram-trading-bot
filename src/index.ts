import { bot } from "./bot.js";
import { handleStart } from "./handlers/start.js";
import { 
  handleStartQualification, 
  handleSourceSelection, 
  handleCommitmentResponse,
  handleLivestreamsResponse,
  handleFundsResponse
} from "./handlers/source.js";
import { sendAbandonmentReminder } from "./services/funnel.js";
import { loadLeadsFromDisk } from "./services/leads.js";

// Handle /start command
bot.command("start", handleStart);

// Helper command to get Chat/User ID to put in ADMIN_ID in .env
bot.command("my_id", async (ctx) => {
  const id = ctx.chat?.id;
  await ctx.reply(`🆔 Your Telegram ID is: <code>${id}</code>\n\nAdd this to your <code>.env</code> file:\n<code>ADMIN_ID=${id}</code>`, {
    parse_mode: "HTML",
  });
});

// Command to instantly preview how the reminder message looks with the logo
bot.command("test_reminder", async (ctx) => {
  const chatId = ctx.chat?.id;
  const name = ctx.from?.first_name || ctx.from?.username || "there";
  if (chatId) {
    await sendAbandonmentReminder(bot, chatId, name);
  }
});

// --- Message Input Keyboard Listeners (Reply Keyboard) ---

// 1. Ready button
bot.hears(/Yes, I'm ready/i, handleStartQualification);

// 2. Traffic Source buttons
bot.hears("Social Media", async (ctx) => {
  await handleSourceSelection(ctx, "Social Media");
});

bot.hears("Streams", async (ctx) => {
  await handleSourceSelection(ctx, "Streams");
});

bot.hears("Friends", async (ctx) => {
  await handleSourceSelection(ctx, "Friends");
});

bot.hears("Others", async (ctx) => {
  await handleSourceSelection(ctx, "Others");
});

// 3. Commitment buttons
bot.hears(/YES\s*I\s*am/i, async (ctx) => {
  await handleCommitmentResponse(ctx, true);
});

bot.hears(/No\s*,\s*I'm\s*not/i, async (ctx) => {
  await handleCommitmentResponse(ctx, false);
});

// 4. Livestream count buttons
bot.hears("Never Came", async (ctx) => {
  await handleLivestreamsResponse(ctx, "Never Came");
});

bot.hears("Once", async (ctx) => {
  await handleLivestreamsResponse(ctx, "Once");
});

bot.hears("Twice", async (ctx) => {
  await handleLivestreamsResponse(ctx, "Twice");
});

bot.hears("More than 3 times", async (ctx) => {
  await handleLivestreamsResponse(ctx, "More than 3 times");
});

// 5. 700 USD requirement buttons
bot.hears(/YES\s*I\s*do/i, async (ctx) => {
  await handleFundsResponse(ctx, true);
});

bot.hears(/NO\s*I\s*don'?t/i, async (ctx) => {
  const { getSession } = await import("./services/funnel.js");
  const userId = ctx.from?.id;
  const session = userId ? getSession(userId) : undefined;
  if (session?.state === "AWAITING_COMMITMENT") {
    await handleCommitmentResponse(ctx, false);
  } else {
    await handleFundsResponse(ctx, false);
  }
});


// --- Backward-Compatible Callback Query Listeners (if old inline buttons exist) ---

bot.callbackQuery("start_qualification", handleStartQualification);

bot.callbackQuery("src_social_media", async (ctx) => {
  await handleSourceSelection(ctx, "Social Media");
});
bot.callbackQuery("src_streams", async (ctx) => {
  await handleSourceSelection(ctx, "Streams");
});
bot.callbackQuery("src_friends", async (ctx) => {
  await handleSourceSelection(ctx, "Friends");
});
bot.callbackQuery("src_others", async (ctx) => {
  await handleSourceSelection(ctx, "Others");
});

bot.callbackQuery("commit_yes", async (ctx) => {
  await handleCommitmentResponse(ctx, true);
});
bot.callbackQuery("commit_no", async (ctx) => {
  await handleCommitmentResponse(ctx, false);
});

async function main() {
  // Load persistent leads from disk
  loadLeadsFromDisk();

  console.log("Connecting to Telegram...");
  const botInfo = await bot.api.getMe();
  console.log(`✅ Bot connected successfully: @${botInfo.username} (${botInfo.first_name})`);

  // Start lightweight HTTP health check server (required for Render Web Service)
  const port = process.env.PORT || 3000;
  const http = await import("node:http");
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      status: "online", 
      bot: `@${botInfo.username}`, 
      uptime: Math.floor(process.uptime()) + "s" 
    }));
  });

  server.listen(port, () => {
    console.log(`🌐 Health check server listening on port ${port}`);
  });

  bot.start({
    onStart: async () => {
      console.log("🚀 Bot is live and listening for updates!");
      const { config } = await import("./config.js");
      if (config.adminId) {
        console.log(`📩 Admin notifications active: delivering to ID ${config.adminId}`);
      } else {
        console.log("⚠️ No ADMIN_ID configured.");
      }
    },
  });
}

main().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
