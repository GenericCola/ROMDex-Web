const WorkEmpty = ({ filtered }: { filtered: boolean }) => {
  return (
    <div className="empty">
      <h3>{filtered ? "No Matching Items" : "No Items Here Yet"}</h3>
      <p>
        {filtered
          ? "Change the filters or search to show more tasks."
          : "Add an item to start organizing this section."}
      </p>
    </div>
  );
};
export default WorkEmpty;
