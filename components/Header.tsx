"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Mark } from "./Mark";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Главная" },
  { href: "/#medics", label: "Медики" },
  { href: "/book", label: "Запись" },
  { href: "/admin", label: "Админка" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <a className="skip" href="#content">
        К содержанию
      </a>
      <div className="topbar-inner">
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <span className="logo-badge">
            <Mark />
          </span>
          Верба
        </Link>
        <button type="button" className="menu-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Закрыть" : "Меню"}
        </button>
        <nav className={open ? "nav open" : "nav"} aria-label="Разделы">
          {LINKS.map((link) => {
            const current = link.href === pathname;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
          <Link className="btn nav-cta" href="/book" onClick={() => setOpen(false)}>
            Записаться
          </Link>
        </nav>
      </div>
    </header>
  );
}
