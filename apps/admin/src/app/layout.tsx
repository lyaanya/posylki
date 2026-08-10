import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VEZY — админка",
  description: "Служебная панель модерации сервиса «VEZY»",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${inter.variable} antialiased`}>
        <header className="border-b border-[var(--color-border)] bg-[var(--color-card)] px-6 py-4">
          <span className="font-[family-name:var(--font-heading)] text-lg font-semibold">
            VEZY · Админка
          </span>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
