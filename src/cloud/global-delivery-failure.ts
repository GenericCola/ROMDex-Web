import { AuthenticationChanged } from "@/auth/cookie-generation";
import { ResumeRejected } from "@/auth/resume-failure";
import { YouTrackHttpError } from "@/youtrack/http-error";
import { DeliveryUncertain } from "./journal";
export const globalDeliveryFailure = (error: unknown) => {
  const cause = error instanceof DeliveryUncertain ? error.cause : error;
  return (
    cause instanceof AuthenticationChanged ||
    cause instanceof ResumeRejected ||
    (cause instanceof YouTrackHttpError && cause.status === 401)
  );
};
