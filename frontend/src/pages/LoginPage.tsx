import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";

interface LoginForm {
  identifier: string;
  password: string;
}

interface InvitationInfo {
  email: string;
  eventName: string;
  eventId: string;
}

export default function LoginPage() {
  const { register, handleSubmit } = useForm<LoginForm>();
  const { user, loading, login } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = searchParams.get("token");
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/events";

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  useEffect(() => {
    if (token) {
      api
        .get(`/api/invitations/${token}`)
        .then((res) => setInvitationInfo(res.data.data))
        .catch(() => toast.error("Invalid or expired invitation"));
    }
  }, [token]);

  const onSubmit = async (data: LoginForm) => {
    try {
      const result = await login(data.identifier, data.password, token || undefined);
      toast.success("Logged in!");
      if (result.eventId) {
        navigate(`/events/${result.eventId}`);
      } else {
        navigate(from, { replace: true });
      }
    } catch {
      toast.error("Invalid credentials");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 px-4">
      <div className="card w-full bg-base-100 shadow-xl sm:max-w-sm">
        <div className="card-body">
          <h2 className="card-title justify-center">Login</h2>

          {invitationInfo && (
            <div className="alert alert-info text-sm">
              <span>
                You have been invited to <strong>{invitationInfo.eventName}</strong>.
                Log in to join.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="form-control">
              <label className="label" htmlFor="login-identifier">
                <span className="label-text">Email or username</span>
              </label>
              <input
                id="login-identifier"
                type="text"
                className="input input-bordered w-full"
                inputMode="email"
                {...register("identifier", { required: true })}
              />
            </div>
            <div className="form-control">
              <label className="label" htmlFor="login-password">
                <span className="label-text">Password</span>
              </label>
              <input
                id="login-password"
                type="password"
                className="input input-bordered w-full"
                {...register("password", { required: true })}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
