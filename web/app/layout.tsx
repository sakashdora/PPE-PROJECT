import type { Metadata } from "next";
import { GSAPInitializer } from "@/components/GSAPInitializer";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('argus-theme');
                if (!theme) {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.dataset.theme = theme;
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="h-full bg-base text-text-primary antialiased selection:bg-brand-accent selection:text-white overflow-hidden">
        <GSAPInitializer />
        {children}
      </body>
    </html>
  );
}
