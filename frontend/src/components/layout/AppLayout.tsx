import { type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuth } from "../../contexts/AuthContext";

export default function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  if (isMobile) {
    return <main className={`pt-12 ${user ? "pb-20" : ""}`}>{children}</main>;
  }

  return <main>{children}</main>;
}
