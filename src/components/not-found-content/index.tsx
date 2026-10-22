import Link from "@components/link";
import StatusPage from "@components/status-page";

/** Shared body of `global-not-found.tsx` and `not-found.tsx`. */
const NotFoundContent = () => {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="The page you are looking for doesn't exist or has moved."
    >
      <Link href="/" variant="filled">
        Go home
      </Link>
    </StatusPage>
  );
};

export default NotFoundContent;
