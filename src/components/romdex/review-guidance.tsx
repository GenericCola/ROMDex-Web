const ReviewGuidance = ({
  choice,
}: {
  choice: "check" | "keep" | "stop" | "rollup" | "create";
}) => {
  const messages = {
    create:
      "If this task already exists, enter its YouTrack ID above. Do not create it again to check.",
    rollup:
      "This status is calculated from child tasks. Your own status choice is kept.",
    keep: "Choosing your version prepares all fields in this change for Save. Nothing is sent yet.",
    stop: "Keeping YouTrack sets aside this entire change, not just one field. Your pending work remains in recovery history.",
    check:
      "We do not know whether the earlier attempt saved. Check first; this will not send it again.",
  };
  return <p>{messages[choice]}</p>;
};
export default ReviewGuidance;
