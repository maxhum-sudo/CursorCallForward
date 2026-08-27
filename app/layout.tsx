import type { Metadata } from "next";
import { Monoton, Oswald, Pacifico, Share_Tech_Mono, Special_Elite } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
});

const monoton = Monoton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-monoton",
});

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pacifico",
});

const specialElite = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-special-elite",
});

const shareTech = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-share-tech",
});

export const metadata: Metadata = {
  title: "Closed Sign",
  description:
    "A second number for a shop that is closed. Texts get an instant reply. Calls become SMS.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${monoton.variable} ${pacifico.variable} ${specialElite.variable} ${shareTech.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-night font-sans text-chrome">
        {children}
      </body>
    </html>
  );
}
