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
const statusOf = (value) => {
  if (["Done", "Fixed", "Complete"].includes(value)) return "green";
  if (["Standby", "Prompt Ready"].includes(value)) return "blue";
  if (
    ["Critical / Debugging", "Critical", "Debugging", "Blocked"].includes(value)
  )
    return "red";
  if (value === "In Development") return "purple";
  if (value === "Awaiting Testing") return "amber";
  if (value === "In Progress") return "yellow";
  return "grey";
};
const rollup = (colors) => {
  if (!colors.length) return null;
  if (colors.includes("red")) return "red";
  if (colors.includes("purple")) return "purple";
  if (colors.every((color) => color === "grey")) return "grey";
  if (colors.some((color) => color === "grey" || color === "yellow"))
    return "yellow";
  if (colors.includes("blue")) return "blue";
  if (colors.includes("amber")) return "amber";
  return "green";
};
module.exports = { states, statusOf, rollup };
