import { type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuth } from "../../contexts/AuthContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

export default function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  if (isMobile) {
    return (
      <main className={`${isOnline ? "pt-12" : "pt-[5.5rem]"} ${user ? "pb-20" : ""}`}>
        {children}
      </main>
    );
  }

  return <main>{children}</main>;
}
