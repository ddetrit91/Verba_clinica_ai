# Публикация

Сайт: https://verba-clinica.vercel.app  
Mini App: https://verba-clinica.vercel.app/tg  
Проект Vercel: `ddetrit/verba-clinica`. Защита SSO выключена, иначе Telegram не откроет страницу.

База — Neon Postgres, драйвер `pg`. `DATABASE_URL` — pooled, им ходят сайт и бот. `DATABASE_URL_UNPOOLED` — прямая строка, ей выполняется миграция схемы при старте. Обе есть в `.env` и в production Vercel. `neon deploy` на Free-плане не проходит: в `neon.ts` включён AI Gateway, файл не переписывался. Auth, Functions, Object Storage, Realtime и AI Gateway не поднимались. Postgres взят у уже связанного проекта (`neon connection-string`), второй проект не создавался. Старый `data/clinic.sqlite`, включая пробную заявку с Vercel, в Neon не переносился. Секреты в репозиторий не коммитить.

Кнопка меню бота «Запись» открывает Mini App. `WEBAPP_URL` — `https://verba-clinica.vercel.app/tg`. Сообщения бота принимает `https://verba-clinica.vercel.app/api/telegram`. Компьютер для чата не нужен. `npm run bot` без `BOT_POLLING=1` ничего не слушает и webhook не снимает. На бесплатном Vercel нельзя запускать проверку каждую минуту, поэтому напоминания за час и за 5 минут без отдельного планировщика не обещаны.

# Локальный запуск

Сайт и бот можно поднять на этой машине. Они ходят в ту же базу Neon.

```bash
npm install
npm run dev
npm run bot
```

Сайт: http://localhost:3000  
Админка: http://localhost:3000/admin

Скопируйте `.env.example` в `.env`.

- `ADMIN_PASSWORD` — пароль админки. В примере: `verba-admin`
- `ADMIN_SECRET` — подпись cookie входа
- `TELEGRAM_BOT_TOKEN` — токен от BotFather
- `TELEGRAM_BOT_USERNAME` — имя бота без `@`, чтобы на лендинге появилась ссылка
- `TELEGRAM_GROUP_CHAT_ID` — куда слать новую заявку и отмену. Сейчас в `.env` это личный чат (положительный id), не id бота. Код берёт только это значение.

## Группа для дублей заявок

1. Создайте бота в BotFather и вставьте токен в `.env`.
2. Добавьте бота в группу клиники и дайте ему право писать сообщения. Удобно сделать бота администратором группы.
3. Узнайте id группы: напишите в группе любое сообщение, затем откройте `https://api.telegram.org/bot<токен>/getUpdates` и найдите `chat.id`. Если сообщений нет, в BotFather отключите privacy (`/setprivacy` → Disable) либо перешлите сообщение из группы в @userinfobot / @RawDataBot.
4. Вставьте id в `TELEGRAM_GROUP_CHAT_ID` и запустите один `npm run bot`.
5. Заявка с сайта уходит в этот чат сразу, даже если процесс бота не запущен: сайт сам вызывает Bot API. Бот нужен, чтобы принимать записи из Telegram. Подтверждение клиенту в диалоге бота остаётся у того, кто записался из Telegram, и не подменяет адрес клиники.

Мокап-заявки при первом создании базы в группу не отправляются.

Секреты храните только в `.env`.
