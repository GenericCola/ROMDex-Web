"use client";

import ErrorContent, { type ErrorProps } from "@components/error-content";

const ErrorPage = (props: ErrorProps) => {
  return <ErrorContent {...props} />;
};

export default ErrorPage;
