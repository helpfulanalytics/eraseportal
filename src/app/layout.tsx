import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { DesktopOnlyOverlay } from "@/components/desktop-only-overlay";
import { Agentation } from "agentation";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The app this replaces (kitchen.co) led with Pretendard and fell back to the
// platform UI font. We ship the fallback only: no network request, no swap,
// and the metrics the 13/14px scale was tuned against.
const SANS_STACK = [
  "-apple-system",
  "BlinkMacSystemFont",
  "system-ui",
  "Roboto",
  '"Helvetica Neue"',
  '"Segoe UI"',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  "sans-serif",
].join(", ");

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ),
  title: {
    template: "%s | Erase Friction Portal",
    default: "Erase Friction Portal",
  },
  description: "Client workspace — folders, conversations, files, and tasks.",
  openGraph: {
    title: "Erase Friction Portal",
    description: "Client workspace — folders, conversations, files, and tasks.",
    siteName: "Erase Friction Portal",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Erase Friction Portal",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Erase Friction Portal",
    description: "Client workspace — folders, conversations, files, and tasks.",
    images: ["/api/og"],
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
      className={`${geistMono.variable} h-full antialiased`}
      style={{ "--font-sans": SANS_STACK } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DesktopOnlyOverlay />
          {children}
          {process.env.NODE_ENV === "development" ? <Agentation /> : null}
        </ThemeProvider>
      </body>
    </html>
  );
}
