import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";

interface Invitation {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

interface Props {
  eventId: string;
}

export default function InvitationManager({ eventId }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const { register, handleSubmit, reset } = useForm<{ email: string }>();

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/invitations`);
      setInvitations(res.data.data);
    } catch {
      // silently fail
    }
  }, [eventId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const onSubmit = async (data: { email: string }) => {
    try {
      const res = await api.post(`/api/events/${eventId}/invitations`, { email: data.email });
      const token = res.data.data.invitation.token;
      const link = `${window.location.origin}/invite/${token}`;

      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Invitation created! Link copied.");
      reset();
      fetchInvitations();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to send invitation";
      toast.error(message);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return "badge-warning";
      case "ACCEPTED":
        return "badge-success";
      case "EXPIRED":
        return "badge-error";
      default:
        return "badge-ghost";
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 mb-4">
        <input
          type="email"
          placeholder="Email address"
          className="input input-bordered flex-1"
          {...register("email", { required: true })}
        />
        <button type="submit" className="btn btn-primary">
          Invite
        </button>
      </form>

      {invitations.length === 0 ? (
        <p className="text-sm opacity-60">No invitations yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>
                    <span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span>
                  </td>
                  <td>{new Date(inv.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
