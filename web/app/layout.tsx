import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Industrial Safety AI — Supervisor Dashboard",
  description:
    "Real-time edge computer vision safety monitoring: fire, smoke, smoking, and PPE compliance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-industrial-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
