"use client";

import { useEffect, useState } from "react";
import { BookingDesk } from "@/components/BookingDesk";

const SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js";

export type TelegramBookingLink = {
  userId: string;
  initData: string;
  suggestedName: string;
};

function readTelegram(): TelegramBookingLink | null {
  const app = window.Telegram?.WebApp;
  if (!app) return null;
  app.ready();
  app.expand();
  try {
    app.setHeaderColor?.("#020617");
    app.setBackgroundColor?.("#020617");
  } catch {
    // Старые клиенты Telegram не принимают цвет шапки.
  }
  const user = app.initDataUnsafe?.user;
  const userId = user?.id == null ? "" : String(user.id);
  if (!/^\d{1,20}$/.test(userId) || !app.initData) return null;
  const suggestedName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return { userId, initData: app.initData, suggestedName };
}

export function TelegramBooking() {
  const [telegram, setTelegram] = useState<TelegramBookingLink | null>(null);
  const [outside, setOutside] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const hadLight = root.classList.contains("light");
    root.classList.remove("light");

    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      const link = readTelegram();
      if (window.Telegram?.WebApp) {
        setTelegram(link);
        setOutside(!link);
      }
    };

    apply();
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    const onLoad = () => apply();
    const onError = () => {
      if (!cancelled) setOutside(true);
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    const timer = window.setTimeout(() => {
      apply();
      if (!cancelled && !window.Telegram?.WebApp) setOutside(true);
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
      if (hadLight) root.classList.add("light");
    };
  }, []);

  return (
    <>
      {outside ? (
        <p className="tg-note">
          Полный календарь в Telegram открывается из бота. Здесь заявка сохранится как запись с сайта, телефон всё
          равно нужен.
        </p>
      ) : null}
      <BookingDesk telegram={telegram} />
    </>
  );
}
