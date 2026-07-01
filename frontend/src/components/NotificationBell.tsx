import { Bell, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  deleteNotification,
  getUnreadNotificationsCount,
  listNotifications,
  markNotificationRead,
  openNotificationsStream
} from "../api/notificationsDatasource";
import type { Notification } from "../entities/notification/notification";

type NotificationBellProps = {
  emptyLabel: string;
  onNotificationOpen?: (notification: Notification) => void;
};

export function NotificationBell({ emptyLabel, onNotificationOpen }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const markingReadRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [items, unread] = await Promise.all([listNotifications(), getUnreadNotificationsCount()]);
      if (cancelled) return;
      setNotifications(items);
      setUnreadCount(unread.count);
    }

    void load().catch(() => undefined);

    const stream = openNotificationsStream((notification) => {
      setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)]);
      setUnreadCount((current) => current + 1);
    });

    return () => {
      cancelled = true;
      stream.close();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpen() {
    setOpen((current) => !current);
  }

  async function markAsRead(notification: Notification) {
    if (notification.read_at || markingReadRef.current.has(notification.id)) return;

    markingReadRef.current.add(notification.id);
    const optimisticReadAt = new Date().toISOString();
    setUnreadCount((current) => Math.max(0, current - 1));
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, read_at: optimisticReadAt } : item))
    );
    const updated = await markNotificationRead(notification.id).catch(() => null);
    markingReadRef.current.delete(notification.id);
    if (!updated) {
      setUnreadCount((current) => current + 1);
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read_at: notification.read_at } : item))
      );
      return;
    }

    setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  function handleNotificationClick(notification: Notification) {
    setOpen(false);
    onNotificationOpen?.(notification);
  }

  async function handleDelete(notificationId: string) {
    await deleteNotification(notificationId).catch(() => undefined);
    setNotifications((current) => current.filter((item) => item.id !== notificationId));
  }

  return (
    <div className="notification-root" ref={rootRef}>
      <button className="notification-trigger" type="button" onClick={handleOpen} aria-label="Notifications">
        <Bell size={18} />
        {unreadCount > 0 ? <span>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notification-panel">
          {notifications.length === 0 ? <div className="notification-empty">{emptyLabel}</div> : null}
          {notifications.map((notification) => (
            <article
              className={notification.read_at ? "notification-item" : "notification-item unread"}
              key={notification.id}
              onMouseEnter={() => void markAsRead(notification)}
              onFocus={() => void markAsRead(notification)}
              onClick={() => handleNotificationClick(notification)}
            >
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
                <span>{new Date(notification.created_at).toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDelete(notification.id);
                }}
                aria-label="Delete notification"
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
