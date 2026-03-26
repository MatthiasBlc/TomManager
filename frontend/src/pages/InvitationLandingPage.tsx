import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../config/api";

type Status = "loading" | "error";

export default function InvitationLandingPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) return;

    api
      .get(`/api/invitations/${token}`)
      .then((res) => {
        const { hasAccount, email } = res.data.data;
        if (hasAccount) {
          navigate(`/login?token=${token}`, { replace: true });
        } else {
          navigate(`/signup?token=${token}&email=${encodeURIComponent(email)}`, {
            replace: true,
          });
        }
      })
      .catch((err) => {
        setStatus("error");
        const code = err.response?.status;
        if (code === 410) {
          setErrorMessage("This invitation has expired.");
        } else if (code === 409) {
          setErrorMessage("This invitation has already been used.");
        } else {
          setErrorMessage("Invitation not found.");
        }
      });
  }, [token, navigate]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 px-4">
      <div className="card w-full bg-base-100 shadow-xl sm:max-w-sm">
        <div className="card-body items-center text-center">
          <h2 className="card-title">Invitation</h2>
          <div className="alert alert-error">
            <span>{errorMessage}</span>
          </div>
          <a href="/login" className="btn btn-primary btn-block mt-4">
            Go to login
          </a>
        </div>
      </div>
    </div>
  );
}
