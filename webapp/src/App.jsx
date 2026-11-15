import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import CodeLoginPage from "./pages/CodeLoginPage";
import StudentsPage from "./pages/StudentsPage";
import GuardianLoginPage from "./pages/GuardianLoginPage";
import GuardianHomePage from "./pages/GuardianHomePage";
import GuardianHistoryPage from "./pages/GuardianHistoryPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login-code" element={<CodeLoginPage />} />
      <Route path="/students" element={<StudentsPage />} />
      <Route path="/guardian" element={<GuardianLoginPage />} />
      <Route path="/guardian/home" element={<GuardianHomePage />} />
      <Route path="/guardian/history" element={<GuardianHistoryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
