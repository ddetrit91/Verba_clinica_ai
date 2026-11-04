import { createBot } from "../lib/telegram-bot";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error("Нужен TELEGRAM_BOT_TOKEN в .env.");
    process.exit(1);
  }
  if (process.env.BOT_POLLING !== "1") {
    console.info("Бот принимает сообщения на Vercel, локальный процесс не нужен.");
    console.info("Не запускайте long polling: он снимет webhook, и бот замолчит при выключенном компьютере.");
    return;
  }

  const bot = createBot(token);
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  console.warn("Включён локальный long polling. Webhook снят, без этого компьютера бот молчит.");
  await bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: (me) => console.info(`Бот @${me.username} слушает обновления на этом компьютере`),
  });
}

void main().catch((error) => {
  console.error("Бот аварийно остановился", error);
  process.exit(1);
});
