import { useState, useRef, useEffect } from "react";
import { useNotifications } from "../../hooks/useNotifications";
import { useIsMobile } from "../../hooks/useIsMobile";
import MobileSheet from "../common/MobileSheet";
import NotificationItem from "./NotificationItem";
import { SkeletonNotificationList } from "../common/Skeleton";
import { BellIcon } from "../common/icons";

function NotificationList({
  notifications,
  isLoading,
  hasMore,
  loadMore,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  unreadCount,
  isMobile,
  onNavigate,
}: ReturnType<typeof useNotifications> & { isMobile: boolean; onNavigate: () => void }) {
  const touchTarget = isMobile ? "min-h-[44px]" : "";
  return (
    <>
      {/* Sur mobile le titre est deja porte par le MobileSheet : on ne garde que l'action */}
      {(!isMobile || unreadCount > 0) && (
        <div
          className={`flex items-center px-3 py-2 border-b border-base-300 ${
            isMobile ? "justify-end" : "justify-between"
          }`}
        >
          {!isMobile && <span className="text-sm font-semibold">Notifications</span>}
          {unreadCount > 0 && (
            <button
              className={`btn btn-ghost btn-xs text-xs ${touchTarget}`}
              onClick={markAllAsRead}
            >
              Tout marquer lu
            </button>
          )}
        </div>
      )}
      <div className="overflow-y-auto flex-1 divide-y divide-base-200">
        {isLoading && notifications.length === 0 && <SkeletonNotificationList count={4} />}
        {notifications.length === 0 && !isLoading && (
          <div className="text-center py-8 animate-fade-in">
            <span className="text-3xl mb-2 block">🔔</span>
            <p className="text-sm opacity-50">Aucune notification</p>
          </div>
        )}
        {notifications.map((notif) => (
          <NotificationItem
            key={notif.id}
            notification={notif}
            onMarkAsRead={markAsRead}
            onDelete={deleteNotification}
            onNavigate={onNavigate}
          />
        ))}
        {hasMore && (
          <button
            className={`btn btn-ghost btn-sm w-full text-xs ${touchTarget}`}
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? "Chargement..." : "Voir plus"}
          </button>
        )}
      </div>
    </>
  );
}

export default function NotificationBell() {
  const notifData = useNotifications();
  const { unreadCount } = notifData;
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click (desktop only)
  useEffect(() => {
    if (!open || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, isMobile]);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          className={`btn btn-ghost btn-sm relative ${isMobile ? "min-h-[44px] min-w-[44px]" : ""}`}
          onClick={() => setOpen(!open)}
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="badge badge-xs badge-primary absolute -top-1 -right-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Desktop dropdown */}
        {open && !isMobile && (
          <div className="absolute right-0 mt-2 w-80 bg-base-100 rounded-lg shadow-lg border border-base-300 z-50 max-h-96 flex flex-col">
            <NotificationList {...notifData} isMobile={false} onNavigate={() => setOpen(false)} />
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && (
        <MobileSheet open={open} onClose={() => setOpen(false)} title="Notifications">
          <NotificationList {...notifData} isMobile={true} onNavigate={() => setOpen(false)} />
        </MobileSheet>
      )}
    </>
  );
}
