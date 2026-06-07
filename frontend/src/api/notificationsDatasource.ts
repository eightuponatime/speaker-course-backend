import type { Notification } from "../entities/notification/notification";
import { apiBaseUrl, request } from "./http";

export function listNotifications(): Promise<Notification[]> {
  return request<Notification[]>("/notifications/?limit=50");
}

export function getUnreadNotificationsCount(): Promise<{ count: number }> {
  return request<{ count: number }>("/notifications/unread-count");
}

export function markAllNotificationsRead(): Promise<void> {
  return request<void>("/notifications/read", {
    method: "PATCH"
  });
}

export function markNotificationRead(notificationId: string): Promise<Notification> {
  return request<Notification>(`/notifications/${notificationId}/read`, {
    method: "PATCH"
  });
}

export function deleteNotification(notificationId: string): Promise<void> {
  return request<void>(`/notifications/${notificationId}`, {
    method: "DELETE"
  });
}

export function openNotificationsStream(onNotification: (notification: Notification) => void): EventSource {
  const stream = new EventSource(`${apiBaseUrl}/notifications/stream`, {
    withCredentials: true
  });

  stream.addEventListener("notification", (event) => {
    onNotification(JSON.parse(event.data) as Notification);
  });

  return stream;
}
