import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const siteTitle = "Milaidy Contributor Dashboard";
const siteDescription = "Trust scoring, leaderboard, badges, and agent rankings for milady-ai/milaidy contributors.";
const faviconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#fafafa'/><path d='M16 44V20h7l9 14 9-14h7v24h-7V31l-9 13-9-13v13z' fill='#7C3AED'/></svg>`;

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "https://trust-dashboard.milady.ai",
    siteName: siteTitle,
    type: "website",
  },
  icons: {
    icon: `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
