import type { Metadata } from 'next';
import './globals.css';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/components/AppSidebar';
import { StatusProvider } from '@/components/StatusProvider';

export const metadata: Metadata = {
  title: '闲鱼价格监控',
  description: '闲鱼商品价格监控与追踪工具',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink antialiased">
        <StatusProvider>
          <AppHeader />
          <div className="flex flex-1">
            <AppSidebar />
            <main className="flex-1 p-4 md:p-6 overflow-auto">
              {children}
            </main>
          </div>
        </StatusProvider>
      </body>
    </html>
  );
}
