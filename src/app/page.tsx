import AuthGate from "@components/romdex/auth-gate";
import SingleWindow from "@components/romdex/single-window";
const HomePage = () => {
  return (
    <SingleWindow>
      <AuthGate />
    </SingleWindow>
  );
};
export default HomePage;
