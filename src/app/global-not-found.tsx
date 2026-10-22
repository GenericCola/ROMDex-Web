import { site } from "@/site";
import NotFoundContent from "@components/not-found-content";
import { fontVariables } from "@styles/fonts";
import "@styles/globals.css";
import { THEME_INIT_SCRIPT } from "@utils/theme";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "Page not found",
};

/** 404 for unmatched URLs. It renders its own document for static export. */
const GlobalNotFound = () => {
  return (
    <html lang="en" className={fontVariables}>
      <head>
        <script>{THEME_INIT_SCRIPT}</script>
      </head>
      <body>
        <NotFoundContent />
      </body>
    </html>
  );
};

export default GlobalNotFound;
