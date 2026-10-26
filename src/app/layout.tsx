import type { Metadata, Viewport } from "next";
import { Rubik, Rubik_Mono_One, Space_Mono } from "next/font/google";
import { asset } from "@/lib/basePath";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const rubikMonoOne = Rubik_Mono_One({
  variable: "--font-rubik-mono-one",
  subsets: ["latin"],
  weight: "400",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  title: "Wiskunde in de stad",
  description: "Een wiskundetocht door Gent.",
  icons: { icon: asset("/icon.svg") },
  appleWebApp: { capable: true, title: "Wiskunde", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#E4E4DF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Font variables go on <html> so tokens.css can resolve them on :root.
    <html
      lang="nl"
      className={`${rubik.variable} ${rubikMonoOne.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
