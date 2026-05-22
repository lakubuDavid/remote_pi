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

const siteDescription =
  "Control your Pi coding agent from your phone. End-to-end encrypted, multi-agent mesh, open source.";

export const metadata: Metadata = {
  metadataBase: new URL("https://remote-pi.jacobmoura.work"),
  title: {
    default: "Remote Pi — Control your Pi coding agent from your phone",
    template: "%s · Remote Pi",
  },
  description: siteDescription,
  applicationName: "Remote Pi",
  authors: [{ name: "Flutterando", url: "https://flutterando.com.br" }],
  keywords: [
    "Remote Pi",
    "Pi coding agent",
    "remote agent control",
    "end-to-end encryption",
    "multi-agent mesh",
  ],
  openGraph: {
    type: "website",
    url: "https://remote-pi.jacobmoura.work",
    title: "Remote Pi — Control your Pi coding agent from your phone",
    description: siteDescription,
    siteName: "Remote Pi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Remote Pi — Control your Pi coding agent from your phone",
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
