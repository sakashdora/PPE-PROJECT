import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Factory Safety AI — Supervisor Dashboard",
  description: "Real-time edge computer vision safety monitoring: fire, smoke, smoking, and PPE compliance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-industrial-950 text-slate-100 antialiased selection:bg-red-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
