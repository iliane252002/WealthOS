"use client";

import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Clock, DollarSign, Wrench, FileText, Users, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

interface TimelineEvent {
  id: string;
  type: "rent_paid" | "rent_late" | "work" | "document" | "lease";
  title: string;
  description: string;
  date: string;
  amount?: number;
}

export default function TimelinePage() {
  const [filter, setFilter] = useState("all");
  const { t } = useI18n();

  const filterLabels: Record<string, string> = {
    all: t("timeline.all"),
    rent_paid: t("timeline.rentPaid"),
    rent_late: t("timeline.lateRent"),
    work: t("timeline.work"),
  };

  const { data: rentEvents } = useQuery<Array<{ id: string; dueDate: string; amount: number; status: string; paidDate: string | null; lease: { lot: { label: string; property: { name: string } }; tenant: { firstName: string; lastName: string } } }>>({
    queryKey: ["rent-events-timeline"],
    queryFn: () => fetch("/api/rent-events").then((r) => r.json()),
  });

  const { data: works } = useQuery<Array<{ id: string; title: string; status: string; cost: number | null; startDate: string | null; createdAt: string; property: { name: string } | null }>>({
    queryKey: ["works-timeline"],
    queryFn: () => fetch("/api/works").then((r) => r.json()),
  });

  const events: TimelineEvent[] = [];

  (rentEvents || []).forEach((re) => {
    if (re.status === "PAID") {
      events.push({
        id: `rent-paid-${re.id}`,
        type: "rent_paid",
        title: `${t("timeline.rentPaid")} - ${re.lease?.lot?.property?.name}`,
        description: `${re.lease?.tenant?.firstName} ${re.lease?.tenant?.lastName} - ${re.lease?.lot?.label}`,
        date: re.paidDate || re.dueDate,
        amount: re.amount,
      });
    } else if (re.status === "LATE") {
      events.push({
        id: `rent-late-${re.id}`,
        type: "rent_late",
        title: `${t("timeline.lateRent")} - ${re.lease?.lot?.property?.name}`,
        description: `${re.lease?.tenant?.firstName} ${re.lease?.tenant?.lastName} - ${re.lease?.lot?.label}`,
        date: re.dueDate,
        amount: re.amount,
      });
    }
  });

  (works || []).forEach((w) => {
    events.push({
      id: `work-${w.id}`,
      type: "work",
      title: w.title,
      description: `${w.property?.name || "General"} - ${w.status}`,
      date: w.startDate || w.createdAt,
      amount: w.cost || undefined,
    });
  });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
    rent_paid: { icon: DollarSign, color: "bg-emerald-100 text-emerald-600" },
    rent_late: { icon: AlertTriangle, color: "bg-red-100 text-red-600" },
    work: { icon: Wrench, color: "bg-blue-100 text-blue-600" },
    document: { icon: FileText, color: "bg-purple-100 text-purple-600" },
    lease: { icon: Users, color: "bg-amber-100 text-amber-600" },
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("timeline.title")}</h1>

      <div className="flex gap-2">
        {["all", "rent_paid", "rent_late", "work"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Clock size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("timeline.noEvents")}</h3>
          <p className="text-slate-500">{t("timeline.noEventsDesc")}</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-4">
            {filtered.map((event) => {
              const config = typeConfig[event.type] || typeConfig.work;
              const Icon = config.icon;
              return (
                <div key={event.id} className="relative flex gap-4 pl-12">
                  <div className={`absolute left-4 -translate-x-1/2 p-1.5 rounded-full ${config.color} z-10`}>
                    <Icon size={14} />
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-900 text-sm">{event.title}</h4>
                      <span className="text-xs text-slate-400">{formatDate(event.date)}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{event.description}</p>
                    {event.amount && (
                      <p className="text-sm font-semibold text-slate-900 mt-1">{formatCurrency(event.amount)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
