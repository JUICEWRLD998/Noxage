import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { Web3Provider } from "@/components/providers/Web3Provider";
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

export const metadata: Metadata = {
  title: "Noxage — Public liquidity. Private strategy.",
  description:
    "Confidential intent settlement for open DeFi. Encrypt size and direction, net in TEE, settle residual on Uniswap. Built on iExec Nox.",
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
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
