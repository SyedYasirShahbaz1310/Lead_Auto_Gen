import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "LenGen AI - Autonomous Lead Gen & Cold Outreach Engine",
  description: "Production-ready zero-SQL Lead Generation, Verification, AI Personalization & Cold Outreach Engine powered by Google Sheets and FastAPI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex antialiased selection:bg-primary-500/30 selection:text-primary-300">
        <ThemeProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 radial-gradient-bg min-h-screen">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
