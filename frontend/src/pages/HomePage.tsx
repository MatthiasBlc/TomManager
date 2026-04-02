import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/events", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center px-4">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold md:text-5xl">TomManager</h1>
          <p className="py-4 text-sm md:py-6 md:text-base">
            Welcome to TomManager. Start building your application.
          </p>
          <a href="/login" className="btn btn-primary btn-block sm:btn-wide">
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
}
