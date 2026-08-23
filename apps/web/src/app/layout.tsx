import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VEZZY — доставка с попутчиками",
  description: "P2P-доставка посылок с попутчиками между Россией и странами проживания экспатов",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${inter.variable}`}>
      <body className="antialiased">
        <Header />
        <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 md:pb-12">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
