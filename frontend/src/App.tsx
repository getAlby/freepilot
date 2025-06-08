import { Link, Navigate, Route, Routes } from "react-router-dom"; // Import routing components
import Logo from "./assets/logo.svg";
import { HomePage } from "./pages/HomePage";
import { JobPage } from "./pages/JobPage";

function App() {
  return (
    <div className="font-sans flex flex-col items-center justify-center min-h-screen pb-8">
      <header className="flex flex-col gap-3 items-center justify-center mb-10">
        <Link to="/" className="z-10">
          <img src={Logo} alt="Logo" />
        </Link>
        <p className="text-muted-foreground">
          Bot that tackles your github issues
        </p>
      </header>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="/jobs/:id" element={<JobPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
