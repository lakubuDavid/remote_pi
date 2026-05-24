import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/header";
import { SiteFooter } from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTagline =
  "Remote Pi — A mesh of coding agents across every machine you work from";
const siteDescription =
  "A mesh of coding agents on every machine you work from. Your phone authenticates new peers; the agents talk to each other. Open source, self-hostable.";

export const metadata: Metadata = {
  metadataBase: new URL("https://remote-pi.jacobmoura.work"),
  title: {
    default: siteTagline,
    template: "%s · Remote Pi",
  },
  description: siteDescription,
  applicationName: "Remote Pi",
  authors: [{ name: "Flutterando", url: "https://flutterando.com.br" }],
  keywords: [
    "Remote Pi",
    "agent mesh",
    "coding agents",
    "Pi coding agent",
    "cross-machine coding",
    "self-hostable relay",
  ],
  openGraph: {
    type: "website",
    url: "https://remote-pi.jacobmoura.work",
    title: siteTagline,
    description: siteDescription,
    siteName: "Remote Pi",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTagline,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <SiteHeader />
        <main className="flex-1 flex flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
