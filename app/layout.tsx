import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { isAllowed } from "@/lib/auth";
import { CommandPalette } from "@/components/CommandPalette";
import { CurlyOrb } from "@/components/CurlyOrb";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Curly OS",
  description:
    "A personal OS for the mind — chat with Curly, manage your notes, explore the brain.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08080C",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Chrome (the command palette) only mounts for the allow-listed user. In
  // local dev (CURLY_AUTH_DISABLED=1) isAllowed() is always true.
  const h = await headers();
  const allowed = isAllowed(h);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {allowed && <CommandPalette />}
        {allowed && <CurlyOrb />}
      </body>
    </html>
  );
}
