const WorkTableHead = () => {
  return (
    <thead>
      <tr aria-rowindex={1}>
        <th className="title-column">Name</th>
        <th>Priority</th>
        <th>Complexity</th>
        <th className="actions-column">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
};
export default WorkTableHead;
