import type { Metadata, Viewport } from "next";
import { Baloo_2, Pixelify_Sans } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const pixelify = Pixelify_Sans({
  variable: "--font-pixelify",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Terr'Îles — TERR'ELLES",
  description:
    "Un jeu d'exploration pour découvrir les métiers de l'environnement, à Marseille.",
};

export const viewport: Viewport = {
  themeColor: "#9fe0e0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${baloo.variable} ${pixelify.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
