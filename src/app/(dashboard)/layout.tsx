import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nouveau compte : on passe d'abord par le parcours de bienvenue
  const session = await auth();
  if (session?.user?.id) {
    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { onboardedAt: true } });
    if (user && !user.onboardedAt) redirect("/bienvenue");
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-8 py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
