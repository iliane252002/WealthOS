import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccountTransactions, matchTransactionToRentEvent } from "@/lib/gocardless";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await request.json().catch(() => ({}));
  const connectionId: string | undefined = body.connectionId;

  try {
    // Fetch active connections for this user
    const connections = await db.bankConnection.findMany({
      where: {
        userId,
        status: "ACTIVE",
        ...(connectionId ? { id: connectionId } : {}),
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({ error: "No active bank connections found" }, { status: 404 });
    }

    // Fetch all pending/late rent events for this user (candidates for matching)
    const pendingEvents = await db.rentEvent.findMany({
      where: {
        status: { in: ["PENDING", "DUE", "LATE"] },
        lease: { lot: { property: { userId } } },
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

    let newTransactions = 0;
    let autoMatched = 0;
    let needsReview = 0;

    for (const connection of connections) {
      const accountIds: string[] = JSON.parse(connection.accountIds || "[]");

      // Only fetch since last sync (or last 90 days)
      const dateFrom = connection.lastSyncAt
        ? connection.lastSyncAt.toISOString().slice(0, 10)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      for (const accountId of accountIds) {
        let transactions;
        try {
          transactions = await getAccountTransactions(accountId, dateFrom);
        } catch {
          console.warn(`Failed to fetch transactions for account ${accountId}`);
          continue;
        }

        // Only consider credits (incoming money, positive amount)
        const credits = transactions.filter(
          (tx) => parseFloat(tx.transactionAmount.amount) > 0
        );

        for (const tx of credits) {
          const externalId = tx.transactionId;

          // Skip if already stored
          const existing = await db.bankTransaction.findUnique({
            where: { connectionId_externalId: { connectionId: connection.id, externalId } },
          });
          if (existing) continue;

          newTransactions++;
          const txAmount = parseFloat(tx.transactionAmount.amount);

          // Try to match to a rent event
          const match = matchTransactionToRentEvent(tx, pendingEvents);

          // Store the transaction
          const stored = await db.bankTransaction.create({
            data: {
              connectionId: connection.id,
              externalId,
              bookingDate: tx.bookingDate,
              amount: txAmount,
              currency: tx.transactionAmount.currency,
              debtorName: tx.debtorName || null,
              remittanceInfo:
                tx.remittanceInformationUnstructured ||
                tx.remittanceInformationStructured ||
                null,
              matchStatus: match ? (match.confidence === "HIGH" ? "MATCHED" : "UNMATCHED") : "UNMATCHED",
              rentEventId: match?.confidence === "HIGH" ? match.rentEventId : null,
            },
          });

          // Auto-mark as PAID for HIGH confidence matches
          if (match?.confidence === "HIGH") {
            const today = new Date().toISOString().slice(0, 10);
            await db.rentEvent.update({
              where: { id: match.rentEventId },
              data: {
                status: "PAID",
                paidAmount: txAmount,
                paidDate: tx.bookingDate,
                notes: `Auto-matched via bank sync (${tx.debtorName || "unknown sender"})`,
              },
            });

            // Create notification
            const event = pendingEvents.find((e) => e.id === match.rentEventId);
            if (event) {
              await db.notification.create({
                data: {
                  userId,
                  type: "GENERAL",
                  title: "💳 Loyer reçu automatiquement",
                  message: `${event.amount}€ de ${tx.debtorName || "locataire"} — ${event.lease.lot.property.name} / ${event.lease.lot.label} marqué payé`,
                  link: `/properties/${(event.lease.lot as { propertyId?: string }).propertyId || ""}/lots/${event.lease.lotId || ""}`,
                },
              });
            }
            autoMatched++;
          } else if (match?.confidence === "MEDIUM") {
            // Create a notification asking for confirmation
            await db.notification.create({
              data: {
                userId,
                type: "GENERAL",
                title: "🔍 Virement à confirmer",
                message: `${txAmount}€ reçu de ${tx.debtorName || "inconnu"} — correspondance probable, confirmez manuellement`,
                link: "/settings?tab=banking",
              },
            });
            needsReview++;
            void stored;
          }
        }
      }

      // Update last sync time
      await db.bankConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date() },
      });
    }

    return NextResponse.json({
      newTransactions,
      autoMatched,
      needsReview,
    });
  } catch (error) {
    console.error("Banking sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
