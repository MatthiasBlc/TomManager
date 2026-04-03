import { useForm } from "react-hook-form";
import { useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";

interface SignupForm {
  username: string;
  password: string;
  confirmPassword: string;
}

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signup } = useAuth();
  const token = searchParams.get("token");
  const email = searchParams.get("email") || "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>();

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200 px-4">
        <div className="card w-full bg-base-100 shadow-xl sm:max-w-sm">
          <div className="card-body items-center text-center">
            <h2 className="card-title">Sign Up</h2>
            <div className="alert alert-error">
              <span>An invitation is required to sign up.</span>
            </div>
            <a href="/login" className="btn btn-primary btn-block mt-4">
              Go to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: SignupForm) => {
    try {
      const result = await signup(email, data.username, data.password, token);
      toast.success("Account created!");
      navigate(`/events/${result.eventId}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Signup failed";
      toast.error(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 px-4">
      <div className="card w-full bg-base-100 shadow-xl sm:max-w-sm">
        <div className="card-body">
          <h2 className="card-title justify-center">Sign Up</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="form-control">
              <label className="label" htmlFor="signup-email">
                <span className="label-text">Email</span>
              </label>
              <input
                id="signup-email"
                type="email"
                className="input input-bordered w-full"
                inputMode="email"
                value={email}
                readOnly
                disabled
              />
            </div>
            <div className="form-control">
              <label className="label" htmlFor="signup-username">
                <span className="label-text">Username</span>
              </label>
              <input
                id="signup-username"
                type="text"
                className="input input-bordered w-full"
                {...register("username", {
                  required: "Username is required",
                  minLength: { value: 3, message: "At least 3 characters" },
                })}
              />
              {errors.username && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.username.message}</span>
                </label>
              )}
            </div>
            <div className="form-control">
              <label className="label" htmlFor="signup-password">
                <span className="label-text">Password</span>
              </label>
              <input
                id="signup-password"
                type="password"
                className="input input-bordered w-full"
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "At least 8 characters" },
                })}
              />
              {errors.password && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.password.message}</span>
                </label>
              )}
            </div>
            <div className="form-control">
              <label className="label" htmlFor="signup-confirm">
                <span className="label-text">Confirm password</span>
              </label>
              <input
                id="signup-confirm"
                type="password"
                className="input input-bordered w-full"
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                  validate: (val) => val === watch("password") || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.confirmPassword.message}
                  </span>
                </label>
              )}
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              Create account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
