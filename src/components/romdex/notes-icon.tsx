// Exact desktop app.mjs paper glyph; avoid OS-dependent text glyph substitution.
const NotesIcon = () => {
  return (
    <svg className="paper-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3 1h7v1h1v1h1v1h1v11H3V1zm1 1v12h8V6H9V2H4zm6 1v2h2v-1h-1V3h-1zM5 7h5v1H5V7zm0 3h5v1H5v-1zm0 2h4v1H5v-1z"
      />
    </svg>
  );
};
export default NotesIcon;
