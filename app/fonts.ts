import localFont from "next/font/local";

export const myFont = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "./fonts/IRANSansWeb.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IRANSansWeb_Black.woff2", weight: "900", style: "normal" },
  ],
});
