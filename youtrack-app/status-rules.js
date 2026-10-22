// Ported from the accepted public/core.mjs statusOf/rollup rules; fixtures check their parity.
const states = {
  grey: "To do",
  yellow: "In Progress",
  blue: "Standby",
  purple: "In Development",
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
  return "green";
};
module.exports = { states, statusOf, rollup };
