import type { Metadata } from "next";
import { Inter } from "next/font/google"; // or Outfit
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/lib/utils";

const font = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AutoStream | Veículos Premium",
  description: "A melhor plataforma para comprar seu próximo veículo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={cn(font.className, "min-h-screen bg-background text-foreground antialiased selection:bg-primary/30")}>
        <Navbar />
        <main className="pt-24 min-h-[calc(100vh-80px)]">
          {children}
        </main>
      </body>
    </html>
  );
}
