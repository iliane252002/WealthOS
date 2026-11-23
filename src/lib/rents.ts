import { db } from "@/lib/db";

/** Date du jour au format AAAA-MM-JJ (heure de Paris, pour ne pas basculer de jour vers minuit). */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/** Statut d'une échéance pas encore payée, selon sa date. */
export function unpaidStatus(dueDate: string, notifyDaysBefore: number, today = todayIso()): string {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return "LATE";
  if (diff <= notifyDaysBefore) return "DUE";
  return "PENDING";
}

/** Une échéance est impayée si sa date est passée et qu'il reste quelque chose à encaisser. */
export function isOverdue(e: { dueDate: string; amount: number; paidAmount: number; status: string }, today = todayIso()) {
  return e.status !== "PAID" && e.dueDate < today && e.paidAmount < e.amount;
}

/**
 * Met les loyers à jour pour un utilisateur (ou tous si userId est absent) :
 * 1. crée les échéances mensuelles manquantes des baux actifs, jusqu'au mois en cours ;
 * 2. passe en « en retard » les échéances dépassées non payées, avec une notification
 *    pour les retards récents.
 * Sans effet si tout est déjà à jour, donc on peut l'appeler à chaque ouverture de page.
 */
export async function syncRents(userId?: string) {
  const today = todayIso();
  const currentMonth = today.slice(0, 7);
  const ownerFilter = userId ? { lot: { property: { userId } } } : {};

  const leases = await db.lease.findMany({
    where: { isActive: true, ...ownerFilter },
    include: { rentEvents: { select: { dueDate: true } } },
  });

  const toCreate: Array<{ leaseId: string; dueDate: string; amount: number; status: string }> = [];
  for (const lease of leases) {
    const months = new Set(lease.rentEvents.map((e) => e.dueDate.slice(0, 7)));
    const lastMonth = lease.endDate && lease.endDate.slice(0, 7) < currentMonth ? lease.endDate.slice(0, 7) : currentMonth;
    let [y, m] = lease.startDate.slice(0, 7).split("-").map(Number);
    // Garde-fou : pas plus de 30 ans d'échéances
    for (let i = 0; i < 360; i++) {
      const month = `${y}-${String(m).padStart(2, "0")}`;
      if (month > lastMonth) break;
      if (!months.has(month)) {
        const lastDay = new Date(y, m, 0).getDate();
        const day = Math.min(Math.max(lease.paymentDayOfMonth, 1), lastDay);
        const dueDate = `${month}-${String(day).padStart(2, "0")}`;
        toCreate.push({
          leaseId: lease.id,
          dueDate,
          amount: lease.monthlyRent + lease.charges,
          status: unpaidStatus(dueDate, lease.notifyDaysBefore, today),
        });
      }
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }
  if (toCreate.length > 0) {
    await db.rentEvent.createMany({ data: toCreate, skipDuplicates: true });
  }

  // Échéances dépassées encore « à venir » → en retard
  const newlyLate = await db.rentEvent.findMany({
    where: { status: { in: ["PENDING", "DUE"] }, dueDate: { lt: today }, lease: ownerFilter },
    include: {
      lease: {
        include: {
          lot: { include: { property: { select: { id: true, name: true, userId: true } } } },
          tenant: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (newlyLate.length > 0) {
    await db.rentEvent.updateMany({
      where: { id: { in: newlyLate.map((e) => e.id) } },
      data: { status: "LATE" },
    });
    // Notification seulement pour les retards du dernier mois et demi (pas pour un vieil historique rattrapé)
    const recent = newlyLate.filter((e) => daysBetween(e.dueDate, today) <= 45);
    if (recent.length > 0) {
      await db.notification.createMany({
        data: recent.map((e) => ({
          userId: e.lease.lot.property.userId,
          type: "RENT_LATE",
          title: "Loyer en retard",
          message: `Loyer de ${e.amount} € en retard : ${e.lease.tenant.firstName} ${e.lease.tenant.lastName}, ${e.lease.lot.property.name} – ${e.lease.lot.label} (échéance du ${e.dueDate.split("-").reverse().join("/")})`,
          link: "/loyers",
        })),
      });
    }
  }

  return { created: toCreate.length, late: newlyLate.length };
}
