import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

// Runs before hydration to apply a stored theme choice without a flash of the wrong theme.
// Absence of a stored value (or "system") leaves the DOM untouched so the CSS media query
// in globals.css governs appearance, matching ThemeToggle's own default.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Singapore Personal Inflation Calculator",
  description: "See how inflation affects your own spending, compared to Singapore's official CPI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <div className="flex justify-end px-4 py-2 sm:px-6">
            <ThemeToggle />
          </div>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
