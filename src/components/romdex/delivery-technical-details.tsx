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
      <summary>Technical details</summary>
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
