import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { AdminAuthGate } from "@/components/AdminAuthGate";
import { AdminShell } from "@/components/AdminShell";
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
  title: "VEZZY — админка",
  description: "Служебная панель модерации сервиса «VEZZY»",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${inter.variable} antialiased`}>
        <AdminAuthGate>
          <AdminShell>{children}</AdminShell>
        </AdminAuthGate>
      </body>
    </html>
  );
}
