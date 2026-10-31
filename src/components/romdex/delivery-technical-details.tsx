import type { DeliveryRecord } from "@/cloud/types";
import type { TaskOperation } from "@/domain/types";
const DeliveryTechnicalDetails = ({
  operation,
  record,
}: {
  operation: TaskOperation | undefined;
  record: DeliveryRecord;
}) => {
  return (
    <details>
      <summary>Raw diagnostics (optional)</summary>
      <p>
        You do not need this JSON to resolve the change. Use the comparison and
        choices above.
      </p>
      <p>{record.message}</p>
      <pre className="port-detail-text">
        {JSON.stringify(
          {
            operation,
            conflicts: record.conflicts,
            currentTargets: record.remoteTasks,
          },
          null,
          2,
        )}
      </pre>
    </details>
  );
};
export default DeliveryTechnicalDetails;
