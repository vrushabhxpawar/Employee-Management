import "./App.css";
import EmployeePage from "./components/EmployeePage.jsx";
import { Toaster } from "react-hot-toast";
import useNetworkStatus from "./hooks/useNetworkStatus.js";

function App() {
  const online = useNetworkStatus();
  
  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      {!online && (
        <div
          style={{
            background: "#4169E1",
            color: "white",
            padding: "8px",
            textAlign: "center",
            fontSize: "14px",
          }}
        >
          You are offline. Some features are disabled.
        </div>
      )}
      <EmployeePage />
    </>
  );
}

export default App;
