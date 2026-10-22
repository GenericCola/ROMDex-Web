import NotFoundContent from "@components/not-found-content";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

/** Shown when a page calls `notFound()`, e.g. for a missing post. */
const NotFound = () => {
  return <NotFoundContent />;
};

export default NotFound;
