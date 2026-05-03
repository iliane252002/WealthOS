import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccountTransactions, matchTransactionToRentEvent } from "@/lib/gocardless";

// Called daily by Vercel Cron — syncs all active bank connections for all users
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await db.bankConnection.findMany({
    where: { status: "ACTIVE" },
  });

  let totalMatched = 0;
  let totalNew = 0;

  for (const connection of connections) {
    const accountIds: string[] = JSON.parse(connection.accountIds || "[]");
    const dateFrom = connection.lastSyncAt
      ? connection.lastSyncAt.toISOString().slice(0, 10)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const pendingEvents = await db.rentEvent.findMany({
      where: {
        status: { in: ["PENDING", "DUE", "LATE"] },
        lease: { lot: { property: { userId: connection.userId } } },
      },
      include: {
        lease: {
          include: {
            tenant: { select: { firstName: true, lastName: true } },
            lot: { include: { property: { select: { name: true } } } },
          },
        },
      },
    });

    for (const accountId of accountIds) {
      try {
        const transactions = await getAccountTransactions(accountId, dateFrom);
        const credits = transactions.filter((tx) => parseFloat(tx.transactionAmount.amount) > 0);

        for (const tx of credits) {
          const existing = await db.bankTransaction.findUnique({
            where: { connectionId_externalId: { connectionId: connection.id, externalId: tx.transactionId } },
          });
          if (existing) continue;

          totalNew++;
          const txAmount = parseFloat(tx.transactionAmount.amount);
          const match = matchTransactionToRentEvent(tx, pendingEvents);

          await db.bankTransaction.create({
            data: {
              connectionId: connection.id,
              externalId: tx.transactionId,
              bookingDate: tx.bookingDate,
              amount: txAmount,
              currency: tx.transactionAmount.currency,
              debtorName: tx.debtorName || null,
              remittanceInfo: tx.remittanceInformationUnstructured || tx.remittanceInformationStructured || null,
              matchStatus: match?.confidence === "HIGH" ? "MATCHED" : "UNMATCHED",
              rentEventId: match?.confidence === "HIGH" ? match.rentEventId : null,
            },
          });

          if (match?.confidence === "HIGH") {
            await db.rentEvent.update({
              where: { id: match.rentEventId },
              data: { status: "PAID", paidAmount: txAmount, paidDate: tx.bookingDate, notes: `Auto-sync bancaire (${tx.debtorName || "?"})` },
            });
            const event = pendingEvents.find((e) => e.id === match.rentEventId);
            if (event) {
              await db.notification.create({
                data: {
                  userId: connection.userId,
                  type: "GENERAL",
                  title: "💳 Loyer reçu automatiquement",
                  message: `${event.amount}€ de ${tx.debtorName || "locataire"} — ${event.lease.lot.property.name} marqué payé`,
                  link: "/settings?tab=banking",
                },
              });
            }
            totalMatched++;
          }
        }
      } catch (err) {
        console.warn(`Sync failed for account ${accountId}:`, err);
      }
    }

    await db.bankConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });
  }

  return NextResponse.json({ connections: connections.length, newTransactions: totalNew, autoMatched: totalMatched });
}
