import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Check, Trash2, Inbox } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { supabase, isSupabaseEnabled } from "@/lib/supabase";
import { getNotifications, markNotificationRead, deleteNotification, formatNotificationRow } from "@/lib/storage";
import type { Notification } from "@/types";

const typeStyle: Record<string, { color: string; bg: string; label: string }> = {
  info: { color: "text-sky-600", bg: "bg-sky-600/10", label: "Info" },
  success: { color: "text-emerald-600", bg: "bg-emerald-600/10", label: "Success" },
  warning: { color: "text-amber-600", bg: "bg-amber-600/10", label: "Warning" },
  error: { color: "text-red-600", bg: "bg-red-600/10", label: "Error" },
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const data = await getNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const deleteNotificationById = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !isSupabaseEnabled) return;

    const channel = supabase
      .channel(`notifications-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!payload.new) return;
          const newNotification = formatNotificationRow(payload.new);
          setNotifications((prev) =>
            prev.some((n) => n.id === newNotification.id)
              ? prev
              : [newNotification, ...prev]
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!payload.new) return;
          const updatedNotification = formatNotificationRow(payload.new);
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <DashboardLayout title="Notifications" subtitle="Stay updated with your activity">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your notifications</CardTitle>
              <CardDescription>
                {notifications.filter((n) => !n.read).length} unread
              </CardDescription>
            </div>
            {notifications.some((n) => !n.read) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  notifications.forEach((n) => !n.read && markAsRead(n.id));
                }}
              >
                Mark all read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    !n.read ? "bg-primary/5 border-primary/20" : "border-border"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeStyle[n.type]?.bg || "bg-muted"}`}>
                    <Bell className={`w-5 h-5 ${typeStyle[n.type]?.color || "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <div className="flex items-center gap-1">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                        <Badge variant="muted" className="text-[10px]">
                          {typeStyle[n.type]?.label || "Info"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      <div className="flex items-center gap-1">
                        {!n.read && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markAsRead(n.id)}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => deleteNotificationById(n.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
