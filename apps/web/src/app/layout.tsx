import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "@/styles/globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-src",
  display: "swap",
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans-src",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-src",
  display: "swap",
});

const SITE_NAME = "Noxage";
const TITLE = "Noxage — Public liquidity. Private strategy.";
const DESCRIPTION =
  "Confidential intent settlement for open DeFi. Seal size and direction with on-chain encryption, net opposing flow per epoch, settle only the residual on unmodified Uniswap.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "confidential DeFi",
    "private trading",
    "encrypted intents",
    "MEV protection",
    "ERC-7984",
    "iExec Nox",
    "Uniswap",
    "Sepolia",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // Matches --surface-0 (dark-first); light theme is a runtime override.
  themeColor: "#0b0a10",
  colorScheme: "dark light",
};

const noFoucThemeScript = `
(function(){
  try {
    if (localStorage.getItem("app-theme") === "light") {
      document.documentElement.dataset.theme = "light";
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFoucThemeScript }} />
        <link rel="icon" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
