import { useEffect } from "react";
import useNetworkStatus from "./hooks/useNetworkStatus";
import { syncPendingActions } from "./services/sync.service";
import EmployeePage from "./components/EmployeePage.jsx";
import { Toaster } from "react-hot-toast";

function App() {
  const online = useNetworkStatus();

  useEffect(() => {
    if (online) {
      syncPendingActions();
    }
  }, [online]);

  // also sync on first load if already online
  useEffect(() => {
    if (navigator.onLine) {
      syncPendingActions();
    }
  }, []);

  return (
    <>
    <Toaster position="top-center"/>
      {!online && (
        <div style={{ background: "#4169E1", color: "white", padding: "8px" }}
        className="flex justify-center">
          You are offline. Some features are disabled.
        </div>
      )}
      <EmployeePage />
    </>
  );
}

export default App;
