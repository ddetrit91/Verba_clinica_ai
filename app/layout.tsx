import type { Metadata } from "next";
import { Literata, Onest } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SiteFrame } from "@/components/SiteFrame";
import "./globals.css";

const onest = Onest({
  subsets: ["cyrillic", "latin"],
  variable: "--font-sans-face",
});

const literata = Literata({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display-face",
});

export const metadata: Metadata = {
  title: "Клиника «Верба»",
  description: "Запись на приём: день, время и медик. Казань, ул. Садовая, 18.",
};

const themeScript = `(function(){try{if(localStorage.getItem('verba-theme')==='light')document.documentElement.classList.add('light')}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${onest.variable} ${literata.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SiteFrame>
          <Header />
        </SiteFrame>
        {children}
        <SiteFrame>
          <Footer />
        </SiteFrame>
      </body>
    </html>
  );
}
