import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// fontes no repositório (OFL, ver fonts/LICENSE.txt): o build não depende do Google Fonts
const body = localFont({ variable: "--font-body", src: [
  { path: "./fonts/barlow-latin-400-normal.woff2", weight: "400" },
  { path: "./fonts/barlow-latin-500-normal.woff2", weight: "500" },
  { path: "./fonts/barlow-latin-600-normal.woff2", weight: "600" },
] });
const display = localFont({ variable: "--font-display", src: [
  { path: "./fonts/barlow-condensed-latin-500-normal.woff2", weight: "500" },
  { path: "./fonts/barlow-condensed-latin-600-normal.woff2", weight: "600" },
] });
const mono = localFont({ variable: "--font-mono", src: [
  { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
  { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
] });

export const metadata: Metadata = {
  title: "ImobAI",
  description: "Portal de proprietários e gestão de imóveis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
