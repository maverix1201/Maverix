import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const openSans = Open_Sans({ 
  subsets: ["latin"], 
  variable: "--font-open-sans",
  weight: ['300', '400', '500', '600', '700', '800']
});

export const metadata: Metadata = {
  title: "MaveriX",
  description: "Modern HR Management System",
  icons: {
    icon: [
      { url: "/assets/maverixicon.png", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={openSans.variable}>
      <head>
        {/* Theme Color */}
        <meta name="theme-color" content="#6366f1" />
        
        {/* Favicon */}
        <link
          rel="icon"
          href="/assets/maverixicon.png"
          type="image/png"
        />
        
        {/* External Fonts */}
        <link
          href="https://fonts.cdnfonts.com/css/gotham"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

