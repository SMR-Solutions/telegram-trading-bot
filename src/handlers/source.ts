import { InlineKeyboard, Keyboard, InputFile } from "grammy";
import type { Context } from "grammy";
import path from "node:path";
import fs from "node:fs";
import { bot } from "../bot.js";
import { 
  clearAbandonmentReminder, 
  getSession,
  isSessionAbandoned,
  scheduleStepReminder, 
  sendAbandonedNotice, 
  updateSession 
} from "../services/funnel.js";
import { updateLeadProgress, sendLeadAlert } from "../services/leads.js";

export async function handleStartQualification(ctx: Context) {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {}
  }

  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const name = ctx.from?.first_name || ctx.from?.username || "there";

  if (userId && isSessionAbandoned(userId)) {
    if (chatId) await sendAbandonedNotice(bot, chatId);
    return;
  }

  if (userId) {
    updateLeadProgress(userId, {
      lastStepReached: "Step 2: Traffic Source Question",
    });
    scheduleStepReminder(bot, userId, "AWAITING_SOURCE", chatId, name);
  }

  // Message 1
  await ctx.reply("Alright, let's continue with our application process on to premium.");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Message 2 with 4 options at the message input
  const keyboard = new Keyboard()
    .text("Social Media")
    .text("Streams")
    .row()
    .text("Friends")
    .text("Others")
    .resized()
    .oneTime();

  await ctx.reply("How did you get to know about us?", {
    reply_markup: keyboard,
  });
}

export async function handleSourceSelection(ctx: Context, source: string) {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {}
  }

  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const name = ctx.from?.first_name || ctx.from?.username || "there";

  if (userId && isSessionAbandoned(userId)) {
    if (chatId) await sendAbandonedNotice(bot, chatId);
    return;
  }

  if (userId) {
    updateSession(userId, { source });
    updateLeadProgress(userId, { 
      source,
      lastStepReached: "Step 3: Long-Term Commitment Question" 
    });
    scheduleStepReminder(bot, userId, "AWAITING_COMMITMENT", chatId, name);
  }

  // Message 1
  await ctx.reply("Nice ok! Thanks for letting me know.");

  await new Promise((resolve) => setTimeout(resolve, 600));

  // Message 2
  await ctx.reply("Trading is a long term game, I want people who are interested in learning and growing with me.");

  await new Promise((resolve) => setTimeout(resolve, 600));

  // Message 3 with commitment question
  const keyboard = new Keyboard()
    .text("YES I am!")
    .text("No , I'm not!")
    .resized()
    .oneTime();

  await ctx.reply(
    "Are you willing to commit for the long term? (6-24 months before seeing consistent results)",
    {
      reply_markup: keyboard,
    }
  );
}

export async function handleCommitmentResponse(ctx: Context, willingToCommit: boolean) {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {}
  }

  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const name = ctx.from?.first_name || ctx.from?.username || "there";

  if (userId && isSessionAbandoned(userId)) {
    if (chatId) await sendAbandonedNotice(bot, chatId);
    return;
  }

  if (userId) {
    clearAbandonmentReminder(userId);
    updateSession(userId, { willingToCommit });
  }

  if (willingToCommit) {
    if (userId) {
      updateLeadProgress(userId, {
        willingToCommit: true,
        lastStepReached: "Step 4: Livestreams Attendance Question",
      });
      scheduleStepReminder(bot, userId, "AWAITING_LIVESTREAMS", chatId, name);
    }

    // Message 1
    await ctx.reply("Alright, that's the first of many hurdles down... next question");

    await new Promise((resolve) => setTimeout(resolve, 600));

    // Message 2 with Livestream buttons at input
    const keyboard = new Keyboard()
      .text("Never Came")
      .text("Once")
      .row()
      .text("Twice")
      .text("More than 3 times")
      .resized()
      .oneTime();

    await ctx.reply("How many livestreams have you come for before applying here?", {
      reply_markup: keyboard,
    });
  } else {
    // If not willing to commit
    if (userId) {
      updateLeadProgress(userId, {
        willingToCommit: false,
        status: "DISQUALIFIED",
        lastStepReached: "Step 3: Commitment Question",
        dropOffPoint: "Refused long-term commitment (6-24 months)",
      });
      await sendLeadAlert(bot, userId, "DISQUALIFIED");
    }

    const removeKeyboard = { remove_keyboard: true as const };
    await ctx.reply("Unfortunately you don't qualify for premium.", {
      reply_markup: removeKeyboard,
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    await ctx.reply("I only want people who are willing to play the long game and go the distance with us.");

    await new Promise((resolve) => setTimeout(resolve, 600));

    await ctx.reply("Not to worry, I hope you enjoy our streams and have positive ROI for your attention in the future. Thanks!");
  }
}

export async function handleLivestreamsResponse(ctx: Context, choice: string) {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {}
  }

  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const name = ctx.from?.first_name || ctx.from?.username || "there";

  if (userId && isSessionAbandoned(userId)) {
    if (chatId) await sendAbandonedNotice(bot, chatId);
    return;
  }

  if (userId) {
    clearAbandonmentReminder(userId);
    updateSession(userId, { livestreams: choice });
    updateLeadProgress(userId, {
      livestreams: choice,
      lastStepReached: "Step 5: 700 USD Question",
    });
    scheduleStepReminder(bot, userId, "AWAITING_FUNDS", chatId, name);
  }

  // Response according to choice
  if (choice === "Never Came") {
    await ctx.reply("Wow! It means you must have a bunch of confidence in our results, I appreciate the act of faith.");
  } else {
    // For "Once", "Twice", and "More than 3 times"
    await ctx.reply("Appreciate that you've taken your time to come to our livestreams");
    await new Promise((resolve) => setTimeout(resolve, 600));
    await ctx.reply("I hope that it gives you a positive ROI on your attention");
  }

  await new Promise((resolve) => setTimeout(resolve, 600));

  // Next question
  await ctx.reply("Ok last question, do not pick the wrong option for this.");

  await new Promise((resolve) => setTimeout(resolve, 600));

  // Minimum USD question
  const keyboard = new Keyboard()
    .text("YES  I do!")
    .text("NO I don't!")
    .resized()
    .oneTime();

  await ctx.reply(
    "My minimum requirement to join premium is having 700USD ready to trade with, do you currently have that?",
    {
      reply_markup: keyboard,
    }
  );
}

export async function handleFundsResponse(ctx: Context, hasFunds: boolean) {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {}
  }

  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const name = ctx.from?.first_name || ctx.from?.username || "there";

  if (userId && isSessionAbandoned(userId)) {
    if (chatId) await sendAbandonedNotice(bot, chatId);
    return;
  }

  if (userId) {
    clearAbandonmentReminder(userId);
    updateSession(userId, { 
      hasFunds, 
      state: hasFunds ? "QUALIFIED" : "NOT_QUALIFIED" 
    });

    if (hasFunds) {
      updateLeadProgress(userId, {
        hasFunds: true,
        status: "QUALIFIED",
        lastStepReached: "Completed Application (Qualified 1% Club)",
      });
      await sendLeadAlert(bot, userId, "QUALIFIED");
    } else {
      updateLeadProgress(userId, {
        hasFunds: false,
        status: "DISQUALIFIED",
        lastStepReached: "Step 5: 700 USD Question",
        dropOffPoint: "Does not have 700 USD ready to trade",
      });
      await sendLeadAlert(bot, userId, "DISQUALIFIED");
    }
  }

  // Clean the input reply keyboard
  const removeKeyboard = { remove_keyboard: true as const };

  if (hasFunds) {
    // 1. Passed test
    await ctx.reply(`Alright ${name}, you've passed the application test for now.`, {
      reply_markup: removeKeyboard,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2. Access condition
    await ctx.reply("However, it does not mean you are guaranteed premium access");

    await new Promise((resolve) => setTimeout(resolve, 600));

    // 3. Instruction
    await ctx.reply('Text me "Qualified" at the button below and follow the steps closely in order to gain access into our private community!');

    await new Promise((resolve) => setTimeout(resolve, 600));

    // 4. Final CTA with TGP logo badge and button
    const logoPath = path.resolve(process.cwd(), "assets", "tgp_logo.jpg");
    const finalKeyboard = new InlineKeyboard().url("Talk to Abhi", "https://t.me/TGPtraders");
    const finalCaption = "I will drop you a mandatory text in 2 hours, you are part of the 1% that qualify.";

    if (fs.existsSync(logoPath)) {
      await ctx.replyWithPhoto(new InputFile(logoPath), {
        caption: finalCaption,
        reply_markup: finalKeyboard,
      });
    } else {
      await ctx.reply(finalCaption, {
        reply_markup: finalKeyboard,
      });
    }
  } else {
    // If they clicked "NO I don't!"
    await ctx.reply("Unfortunately you don't qualify for premium.", {
      reply_markup: removeKeyboard,
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    await ctx.reply("I only want people who are willing to play the long game and go the distance with us.");

    await new Promise((resolve) => setTimeout(resolve, 600));

    await ctx.reply("Not to worry, I hope you enjoy our streams and have positive ROI for your attention in the future. Thanks!");
  }
}
