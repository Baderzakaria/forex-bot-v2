import type { Metadata } from "next";
import { Source_Serif_4, Urbanist } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/shell/app-frame";

const urbanist = Urbanist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Forex Bot CMS",
  description: "Light shadcn CMS for forex-bot-v2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${urbanist.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--fx-canvas)] font-sans text-[var(--fx-text-strong)]">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
