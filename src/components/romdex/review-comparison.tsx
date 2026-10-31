import type { DeliveryRecord } from "@/cloud/types";
import type { TaskOperation } from "@/domain/types";
import { reviewFieldLabel, reviewFieldValue } from "./review-field-format";
import {
  proposedOperationSummary,
  reviewTaskSnapshots,
} from "./review-operation-summary";
const ReviewComparison = ({
  operation,
  record,
  items,
}: {
  operation: TaskOperation | undefined;
  record: DeliveryRecord;
  items: string[];
}) => {
  const renderChange = (text: string, index: number) => {
    return <li key={index}>{text}</li>;
  };
  return (
    <>
      {" "}
      {operation?.type === "edit" && record.conflicts?.length ? (
        <ul>
          {record.conflicts.map((conflict) => {
            const tasks = reviewTaskSnapshots(operation, record);
            return (
              <li key={conflict.field}>
                <strong>{reviewFieldLabel(conflict.field, tasks)}</strong>
                <p>
                  YOUR CHANGE:{" "}
                  {reviewFieldValue(conflict.field, conflict.local, tasks)}
                </p>
                <p>
                  CURRENT YOUTRACK:{" "}
                  {reviewFieldValue(conflict.field, conflict.remote, tasks)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul>
          {(operation && operation.type !== "delete"
            ? proposedOperationSummary(operation, record)
            : items
          ).map(renderChange)}
        </ul>
      )}
      {operation?.type === "edit" &&
        Object.keys(operation.patch).length > 1 && (
          <ul>
            {proposedOperationSummary(operation, record).map(renderChange)}
          </ul>
        )}
    </>
  );
};
export default ReviewComparison;
