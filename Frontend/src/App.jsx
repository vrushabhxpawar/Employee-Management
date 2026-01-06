import "./App.css";
import EmployeePage from "./components/EmployeePage.jsx";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <EmployeePage />
    </>
  );
}

export default App;
