"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { FileText, Plus, X, Search, Upload, Download, Trash2, Eye } from "lucide-react";
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showUpload, setShowUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("OTHER");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadingFile(true);

      // Step 1: Upload the file
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }
      const uploaded = await uploadRes.json();

      // Step 2: Create the document record
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploaded.name,
          category: selectedCategory,
          fileUrl: uploaded.url,
          fileType: uploaded.type,
          fileSize: uploaded.size,
          propertyId: selectedPropertyId || undefined,
          description: description || undefined,
        }),
      });
      if (!docRes.ok) throw new Error("Failed to create document");
      return docRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setUploadingFile(false);
      setShowUpload(false);
      setSelectedCategory("OTHER");
      setSelectedPropertyId("");
      setDescription("");
    },
    onError: () => setUploadingFile(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const handleFileDrop = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
    setIsDragging(false);
  }, [uploadMutation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("documents.title")}</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {showUpload ? <X size={16} /> : <Upload size={16} />}
          {showUpload ? t("documents.cancel") : t("documents.addDocument")}
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

      {/* Upload Form with Drag & Drop */}
      {showUpload && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          {/* Metadata fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("documents.category")}</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {categories.filter(c => c !== "ALL").map((c) => (
                  <option key={c} value={c}>{t(categoryKeys[c])}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("documents.property")}</label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">{t("documents.none")}</option>
                {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("documents.description")}</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Optional description..."
              />
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); handleFileDrop(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleFileDrop(e.target.files)}
            />
            {uploadingFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-blue-600 font-medium">{t("lotDetail.uploading")}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-slate-100 rounded-full">
                  <Upload size={32} className={isDragging ? "text-blue-400" : "text-slate-400"} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{t("lotDetail.dragDropHere")}</p>
                  <p className="text-xs text-slate-400 mt-1">{t("lotDetail.maxFileSize")}</p>
                </div>
              </div>
            )}
          </div>

          {uploadMutation.isError && (
            <p className="text-sm text-red-500">{(uploadMutation.error as Error).message}</p>
          )}
        </div>
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
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between hover:border-blue-200 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FileText size={20} className="text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{t(categoryKeys[doc.category]) || doc.category}</span>
                    {doc.property && <span className="text-xs text-slate-400">{doc.property.name}</span>}
                    {doc.lot && <span className="text-xs text-slate-400">/ {doc.lot.label}</span>}
                    <span className="text-xs text-slate-300">{formatFileSize(doc.fileSize)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.fileUrl && doc.fileUrl !== "/uploads/placeholder" && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View"
                  >
                    <Eye size={16} />
                  </a>
                )}
                <button
                  onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(doc.id); }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
