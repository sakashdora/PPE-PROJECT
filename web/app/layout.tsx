import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ARGUS AI — Factory Safety", description: "Factory safety monitoring, incident review and supervisor response." };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en" data-theme="dark"><body>{children}</body></html>; }
