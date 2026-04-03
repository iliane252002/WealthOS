"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Plus, X, Search, Filter } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Document {
  id: string;
  name: string;
  category: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  description: string | null;
  property: { id: string; name: string } | null;
  lot: { id: string; label: string } | null;
  createdAt: string;
}

const categories = [
  "ALL", "LEASE_CONTRACT", "INSURANCE", "TAX", "INVOICE", "PHOTO", "DIAGNOSTIC", "RECEIPT", "OTHER",
];

const categoryKeys: Record<string, TranslationKey> = {
  LEASE_CONTRACT: "documents.lease", INSURANCE: "documents.insurance", TAX: "documents.tax", INVOICE: "documents.invoice",
  PHOTO: "documents.photo", DIAGNOSTIC: "documents.diagnostic", RECEIPT: "documents.receipt", OTHER: "documents.other",
};

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const { t } = useI18n();

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (categoryFilter !== "ALL") queryParams.set("category", categoryFilter);

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["documents", search, categoryFilter],
    queryFn: () => fetch(`/api/documents?${queryParams}`).then((r) => r.json()),
  });

  const { data: properties } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["properties"],
    queryFn: () => fetch("/api/properties").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const data = {
        name: formData.get("name") as string,
        category: formData.get("category") as string,
        propertyId: formData.get("propertyId") as string || undefined,
        fileUrl: "/uploads/placeholder",
        fileType: "application/pdf",
        fileSize: 0,
        description: formData.get("description") as string || undefined,
      };
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("documents.title")}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? t("documents.cancel") : t("documents.addDocument")}
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("documents.search")}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === "ALL" ? t("documents.allCategories") : t(categoryKeys[c])}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(new FormData(e.currentTarget)); }}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("documents.documentName")}</label>
              <input name="name" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("documents.category")}</label>
              <select name="category" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {categories.filter(c => c !== "ALL").map((c) => (
                  <option key={c} value={c}>{t(categoryKeys[c])}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("documents.property")}</label>
              <select name="propertyId" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">{t("documents.none")}</option>
                {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("documents.description")}</label>
              <input name="description" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
            {createMutation.isPending ? t("documents.saving") : t("documents.save")}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"><div className="h-32 bg-slate-200 rounded" /></div>
      ) : !documents || documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("documents.noDocuments")}</h3>
          <p className="text-slate-500">{t("documents.noDocumentsDesc")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between hover:border-blue-200 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FileText size={20} className="text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{t(categoryKeys[doc.category]) || doc.category}</span>
                    {doc.property && <span className="text-xs text-slate-400">{doc.property.name}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => deleteMutation.mutate(doc.id)} className="text-slate-400 hover:text-red-500">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
