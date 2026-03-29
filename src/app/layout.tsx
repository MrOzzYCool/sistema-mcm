import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { TramitesExternosProvider } from "@/lib/tramites-externos-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portal – I.E.S. Privada Margarita Cabrera",
  description: "Portal estudiantil de la I.E.S. Privada Margarita Cabrera",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <TramitesExternosProvider>{children}</TramitesExternosProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
