import { Link, Navigate, Route, Routes } from "react-router-dom"; // Import routing components
import Logo from "./assets/logo.svg";
import { HomePage } from "./pages/HomePage";
import { JobPage } from "./pages/JobPage";
import { AboutPage } from "./pages/AboutPage";

function App() {
  return (
    <div className="font-sans flex flex-col items-center justify-center min-h-screen p-8">
      <div className="freepilot-bg fixed top-0 left-0 w-full h-full -z-10 opacity-100 max-sm:bg-left" />
      <header className="flex flex-col gap-3 items-center justify-center mb-10">
        <Link to="/" className="z-10">
          {/* <img src={Logo} alt="Logo" /> */}
          <h1 className="font-semibold text-4xl">Alby Freepilot</h1>
        </Link>
        <p className="text-muted-foreground">
          Just write github issues - Freepilot will tackle them
        </p>
      </header>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/jobs/:id" element={<JobPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
