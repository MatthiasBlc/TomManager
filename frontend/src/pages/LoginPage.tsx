import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../config/api";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { register, handleSubmit } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      await api.post("/api/auth/login", data);
      toast.success("Logged in!");
      window.location.href = "/";
    } catch {
      toast.error("Invalid credentials");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title justify-center">Login</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                className="input input-bordered"
                {...register("email", { required: true })}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                {...register("password", { required: true })}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
