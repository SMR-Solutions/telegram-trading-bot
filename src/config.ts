import "dotenv/config";

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing in environment variables (.env).");
}

export const config = {
  botToken: process.env.BOT_TOKEN,
  adminId: process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : undefined,
};
