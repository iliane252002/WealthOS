"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const typeIcons: Record<string, string> = {
  RENT_REMINDER: "bg-amber-100 text-amber-600",
  RENT_LATE: "bg-red-100 text-red-600",
  LEASE_EXPIRING: "bg-purple-100 text-purple-600",
  WORK_COMPLETED: "bg-emerald-100 text-emerald-600",
  GENERAL: "bg-blue-100 text-blue-600",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => fetch("/api/notifications").then((r) => r.json()).then((d) => d.notifications || d),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id?: string) => {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { markAll: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("notifications.title")}</h1>
        <button
          onClick={() => markReadMutation.mutate(undefined)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <CheckCheck size={16} />
          {t("notifications.markAllRead")}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Bell size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("notifications.noNotifications")}</h3>
          <p className="text-slate-500">{t("notifications.allCaughtUp")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const cardContent = (
              <>
                <div className={`p-2 rounded-lg shrink-0 ${typeIcons[notif.type] || typeIcons.GENERAL}`}>
                  <Bell size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${notif.isRead ? "text-slate-600" : "font-medium text-slate-900"}`}>
                      {notif.title}
                    </p>
                    {notif.link && <ExternalLink size={12} className="text-slate-400 shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(notif.createdAt)}</p>
                </div>
                {!notif.isRead && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); markReadMutation.mutate(notif.id); }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                    title="Mark as read"
                  >
                    <Check size={16} />
                  </button>
                )}
              </>
            );

            const baseClass = `bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 transition-colors ${
              notif.isRead ? "border-slate-200" : "border-blue-200 bg-blue-50/30"
            }`;

            return notif.link ? (
              <Link
                key={notif.id}
                href={notif.link}
                className={`${baseClass} hover:border-blue-300 hover:shadow-md cursor-pointer`}
                onClick={() => { if (!notif.isRead) markReadMutation.mutate(notif.id); }}
              >
                {cardContent}
              </Link>
            ) : (
              <div key={notif.id} className={baseClass}>
                {cardContent}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
