import { Bot, InlineKeyboard, Keyboard, session, type Context, type SessionFlavor } from "grammy";
import { emptySession, postgresSessionStorage, type SessionData } from "./bot-session";
import { clinic } from "./clinic";
import { cancelAppointment, createAppointment, listForTelegram } from "./appointments";
import { getMedic, listMedics } from "./medics";
import { daySlots, upcomingOpenDays } from "./slots";
import { formatDay, formatPhone, formatWhen, WEEKDAY_SHORT, weekdayOf } from "./format";
import { publicOrigin } from "./telegram-endpoint";

type BotContext = Context & SessionFlavor<SessionData>;

const MENU = new Set(["Записаться", "Календарь", "Мои записи", "О клинике"]);

function webAppUrl(): { ok: true; url: string } | { ok: false; problem: "empty" | "https" } {
  const raw = process.env.WEBAPP_URL?.trim() ?? "";
  if (!raw) return { ok: false, problem: "empty" };
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return { ok: false, problem: "https" };
    if (url.pathname === "/" || url.pathname === "") url.pathname = "/tg";
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, problem: "https" };
  }
}

function missingAppText(problem: "empty" | "https") {
  if (problem === "https") {
    return "Mini App открывается только по ссылке https://. Укажите в WEBAPP_URL публичный адрес страницы /tg. Запись в чате работает — нажмите «Записаться».";
  }
  return "Календарь в Mini App пока не подключён: в .env нет WEBAPP_URL. Нужен публичный HTTPS на страницу /tg. Запись в чате работает — нажмите «Записаться».";
}

function isPrivate(ctx: BotContext) {
  return ctx.chat?.type === "private";
}

function mainKeyboard(ctx: BotContext) {
  const keyboard = new Keyboard().text("Записаться").row();
  const link = webAppUrl();
  if (link.ok && isPrivate(ctx)) keyboard.webApp("Календарь", link.url).row();
  else keyboard.text("Календарь").row();
  return keyboard.text("Мои записи").text("О клинике").resized().persistent();
}

function startInline(ctx: BotContext) {
  const keyboard = new InlineKeyboard().text("Записаться", "book:start");
  const link = webAppUrl();
  if (link.ok && isPrivate(ctx)) keyboard.row().webApp("Календарь", link.url);
  return keyboard;
}

function clinicText() {
  return [
    clinic.fullName,
    `${clinic.city}, ${clinic.street}`,
    clinic.phone,
    "",
    "Запись: день, время и медик.",
    "На сайте то же расписание, что и в этом боте.",
  ].join("\n");
}

async function openCalendar(ctx: BotContext) {
  const link = webAppUrl();
  if (!link.ok) {
    await ctx.reply(missingAppText(link.problem), { reply_markup: mainKeyboard(ctx) });
    return;
  }
  await ctx.reply("Календарь записи к медику.", {
    reply_markup: new InlineKeyboard().webApp("Открыть календарь", link.url),
  });
}

async function greet(ctx: BotContext) {
  ctx.session.step = { kind: "idle" };
  await ctx.reply(`Здравствуйте. Это запись в ${clinic.fullName}.\nНажмите «Записаться» ниже или в меню.`, {
    reply_markup: mainKeyboard(ctx),
  });
  await ctx.reply("Кнопка записи:", { reply_markup: startInline(ctx) });
}

async function showMedics(ctx: BotContext) {
  ctx.session.step = { kind: "idle" };
  const medics = await listMedics();
  if (medics.length === 0) {
    await ctx.reply("Сейчас нет медиков для записи. Откройте админку и добавьте график.");
    return;
  }
  const keyboard = new InlineKeyboard();
  for (const medic of medics) {
    keyboard.text(`${medic.name}, ${medic.specialty}`, `med:${medic.id}`).row();
  }
  await ctx.reply("Выберите медика.", { reply_markup: keyboard });
}

async function showDays(ctx: BotContext, medicId: number) {
  const medic = await getMedic(medicId);
  if (!medic) {
    await ctx.reply("Медик не найден.");
    return;
  }
  const days = await upcomingOpenDays(medicId, 10);
  if (days.length === 0) {
    await ctx.reply(`У ${medic.name} нет свободных дней в ближайшие три недели.`);
    return;
  }
  const keyboard = new InlineKeyboard();
  for (const day of days) {
    const label = `${WEEKDAY_SHORT[weekdayOf(day.date)]}, ${formatDay(day.date)}, свободно ${day.free}`;
    keyboard.text(label, `day:${medicId}:${day.date}`).row();
  }
  keyboard.text("К медикам", "back:medics");
  await ctx.reply(`${medic.name}, ${medic.specialty}. Выберите день.`, { reply_markup: keyboard });
}

async function showTimes(ctx: BotContext, medicId: number, date: string) {
  const medic = await getMedic(medicId);
  if (!medic) {
    await ctx.reply("Медик не найден.");
    return;
  }
  const slots = (await daySlots(medicId, date)).filter((slot) => !slot.taken);
  if (slots.length === 0) {
    await ctx.reply("В этот день свободного времени нет.");
    return;
  }
  const keyboard = new InlineKeyboard();
  slots.forEach((slot, index) => {
    keyboard.text(slot.time, `time:${medicId}:${date}:${slot.time}`);
    if (index % 3 === 2) keyboard.row();
  });
  keyboard.row().text("К дням", `back:days:${medicId}`);
  await ctx.reply(`${formatDay(date)}. Выберите время.`, { reply_markup: keyboard });
}

async function showMine(ctx: BotContext) {
  const userId = String(ctx.from?.id ?? "");
  const rows = await listForTelegram(userId);
  if (rows.length === 0) {
    await ctx.reply("Активных записей нет.");
    return;
  }
  for (const row of rows) {
    const keyboard = new InlineKeyboard().text("Отменить", `cancel:${row.id}`);
    await ctx.reply(
      [`Заявка ${row.id}`, row.medicName, row.specialty, formatWhen(row.date, row.time), formatPhone(row.clientPhone)].join(
        "\n",
      ),
      { reply_markup: keyboard },
    );
  }
}

export function createBot(token: string) {
  const bot = new Bot<BotContext>(token);
  bot.use(session({ initial: emptySession, storage: postgresSessionStorage() }));

  bot.command("start", async (ctx) => {
    await greet(ctx);
  });
  bot.command("book", async (ctx) => {
    await showMedics(ctx);
  });
  bot.command("my", async (ctx) => {
    await showMine(ctx);
  });
  bot.command("about", async (ctx) => {
    await ctx.reply(clinicText());
  });
  bot.command("app", async (ctx) => {
    await openCalendar(ctx);
  });
  bot.hears("Записаться", async (ctx) => {
    await showMedics(ctx);
  });
  bot.hears("Календарь", async (ctx) => {
    await openCalendar(ctx);
  });
  bot.hears("О клинике", async (ctx) => {
    await ctx.reply(clinicText());
  });
  bot.hears("Мои записи", async (ctx) => {
    await showMine(ctx);
  });
  bot.callbackQuery("book:start", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showMedics(ctx);
  });
  bot.callbackQuery(/^med:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showDays(ctx, Number(ctx.match[1]));
  });
  bot.callbackQuery("back:medics", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showMedics(ctx);
  });
  bot.callbackQuery(/^day:(\d+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showTimes(ctx, Number(ctx.match[1]), ctx.match[2]);
  });
  bot.callbackQuery(/^back:days:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showDays(ctx, Number(ctx.match[1]));
  });
  bot.callbackQuery(/^time:(\d+):(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = {
      kind: "name",
      medicId: Number(ctx.match[1]),
      date: ctx.match[2],
      time: ctx.match[3],
    };
    await ctx.reply("Как к вам обращаться? Имя и фамилия.");
  });
  bot.callbackQuery(/^cancel:(\d+)$/, async (ctx) => {
    const result = await cancelAppointment(Number(ctx.match[1]), String(ctx.from?.id ?? ""));
    await ctx.answerCallbackQuery({ text: result.ok ? "Запись отменена" : result.error });
    if (result.ok) {
      await ctx.editMessageText(
        `Заявка ${result.appointment.id} отменена.\n${result.appointment.medicName}, ${formatWhen(result.appointment.date, result.appointment.time)}`,
      );
    }
  });
  bot.on("message:text", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const text = ctx.message.text.trim();
    if (text.startsWith("/") || MENU.has(text)) return;
    const step = ctx.session.step;
    if (step.kind === "name") {
      ctx.session.step = { kind: "phone", medicId: step.medicId, date: step.date, time: step.time, name: text };
      await ctx.reply("Телефон для связи, например +998 90 000-00-00");
      return;
    }
    if (step.kind === "phone") {
      const result = await createAppointment({
        medicId: step.medicId,
        date: step.date,
        time: step.time,
        clientName: step.name,
        clientPhone: text,
        source: "telegram",
        telegramUserId: String(ctx.from?.id ?? ""),
      });
      ctx.session.step = { kind: "idle" };
      if (!result.ok) {
        await ctx.reply(result.error);
        return;
      }
      const appointment = result.appointment;
      await ctx.reply(
        [
          `Заявка ${appointment.id} принята`,
          `${appointment.medicName}, ${appointment.specialty}`,
          formatWhen(appointment.date, appointment.time),
          formatPhone(appointment.clientPhone),
        ].join("\n"),
      );
      return;
    }
    await ctx.reply("Нажмите «Записаться» или /start, чтобы выбрать медика.", { reply_markup: mainKeyboard(ctx) });
  });
  bot.catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Ошибка обработчика Telegram", message.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[redacted]"));
  });
  return bot;
}

export async function publishBotMenu(token: string) {
  const bot = createBot(token);
  await bot.api.setMyCommands([
    { command: "start", description: "Меню и кнопка записи" },
    { command: "book", description: "Записаться к медику" },
    { command: "my", description: "Мои записи" },
    { command: "about", description: "О клинике" },
    { command: "app", description: "Календарь в Mini App" },
  ]);
  const link = webAppUrl();
  if (link.ok) {
    await bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "Запись", web_app: { url: link.url } },
    });
  }
  return { origin: publicOrigin(), menu: link.ok };
}
