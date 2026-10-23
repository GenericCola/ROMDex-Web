// Ported status rules plus the requested Awaiting Testing web extension; fixtures check parity.
const states = {
  grey: "To do",
  yellow: "In Progress",
  blue: "Standby",
  purple: "In Development",
  amber: "Awaiting Testing",
  green: "Done",
  red: "Critical / Debugging",
};
const youTrackState = (value) => value === "Awaiting Testing" ? "Needs Testing" : value;
const statusOf = (value) => {
  if (["Done", "Fixed", "Complete"].includes(value)) return "green";
  if (["Standby", "Prompt Ready"].includes(value)) return "blue";
  if (
    ["Critical / Debugging", "Critical", "Debugging", "Blocked"].includes(value)
  )
    return "red";
  if (value === "In Development") return "purple";
  if (value === "Awaiting Testing" || value === "Needs Testing") return "amber";
  if (value === "In Progress") return "yellow";
  return "grey";
};
const rollup = (colors) => {
  if (!colors.length) return null;
  if (colors.includes("amber")) return "amber";
  if (colors.includes("red")) return "red";
  if (colors.includes("purple")) return "purple";
  if (colors.every((color) => color === "grey")) return "grey";
  if (colors.some((color) => color === "grey" || color === "yellow"))
    return "yellow";
  // A single Standby child stays in progress; two or more all-Standby children inherit it.
  if (colors.length > 1 && colors.every((color) => color === "blue")) return "blue";
  if (colors.includes("blue")) return "yellow";
  return "green";
};
module.exports = { states, statusOf, rollup, youTrackState };
