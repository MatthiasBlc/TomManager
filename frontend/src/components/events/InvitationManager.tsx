import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useIsMobile } from "../../hooks/useIsMobile";

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
  const isMobile = useIsMobile();
  const { register, handleSubmit, reset } = useForm<{ identifier: string }>();

  const handleRevoke = async (invitationId: string) => {
    try {
      await api.delete(`/api/events/${eventId}/invitations/${invitationId}`);
      toast.success("Invitation revoked");
      fetchInvitations();
    } catch {
      toast.error("Failed to revoke invitation");
    }
  };

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

  const onSubmit = async (data: { identifier: string }) => {
    try {
      const res = await api.post(`/api/events/${eventId}/invitations`, { identifier: data.identifier });
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 mb-4 sm:flex-row">
        <input
          type="text"
          placeholder="Email ou pseudo"
          className="input input-bordered w-full sm:flex-1"
          autoComplete="off"
          {...register("identifier", { required: true })}
        />
        <button type="submit" className="btn btn-primary btn-block sm:btn-wide">
          Invite
        </button>
      </form>

      {invitations.length === 0 ? (
        <p className="text-sm opacity-60">No invitations yet.</p>
      ) : isMobile ? (
        <div className="space-y-2">
          {invitations.map((inv) => (
            <div key={inv.id} className="card bg-base-100 shadow-sm">
              <div className="card-body p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate flex-1 mr-2">{inv.email}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge badge-sm ${statusBadge(inv.status)}`}>{inv.status}</span>
                    {inv.status === "PENDING" && (
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleRevoke(inv.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs opacity-60">
                  {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Sent</th>
                <th></th>
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
                  <td>
                    {inv.status === "PENDING" && (
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleRevoke(inv.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
