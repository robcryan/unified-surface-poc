import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { DISTRICT_NAME } from "@/db/demo-config";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: DISTRICT_NAME,
    template: `%s — ${DISTRICT_NAME}`,
  },
  description:
    "Unified surface prototype for enrollment, learning, student supports and curriculum in a fully virtual K–12 program.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
