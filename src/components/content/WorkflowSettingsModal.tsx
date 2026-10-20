import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
  Sliders,
  Columns,
  Bookmark,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Brand, WorkflowStatusConfig } from '../../types/database.ts';
import {
  workflowSettingsService,
  DEFAULT_CONTENT_PILLARS,
  DEFAULT_WORKFLOW_STATUSES,
  AVAILABLE_STATUS_COLORS,
} from '../../services/database/workflowSettingsService.ts';

interface WorkflowSettingsModalProps {
  isOpen: boolean;
  brand: Brand | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const WorkflowSettingsModal: React.FC<WorkflowSettingsModalProps> = ({
  isOpen,
  brand,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'pillars' | 'workflow'>('pillars');
  const [pillars, setPillars] = useState<string[]>([]);
  const [newPillarInput, setNewPillarInput] = useState('');
  const [statuses, setStatuses] = useState<WorkflowStatusConfig[]>([]);
  const [newStatusTitle, setNewStatusTitle] = useState('');
  const [newStatusColorIndex, setNewStatusColorIndex] = useState(0);

  const [saving, setSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    if (brand && isOpen) {
      setPillars(workflowSettingsService.getPillars(brand));
      setStatuses(workflowSettingsService.getWorkflowStatuses(brand));
      setSuccessNotice(null);
      setErrorNotice(null);
      setNewPillarInput('');
      setNewStatusTitle('');
    }
  }, [brand, isOpen]);

  if (!isOpen || !brand) return null;

  // Handler untuk Pilar
  const handleAddPillar = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newPillarInput.trim();
    if (!val) return;
    if (pillars.some((p) => p.toLowerCase() === val.toLowerCase())) {
      setErrorNotice(`Pilar "${val}" sudah ada dalam daftar.`);
      return;
    }
    setPillars([...pillars, val]);
    setNewPillarInput('');
    setErrorNotice(null);
  };

  const handleRemovePillar = (idx: number) => {
    if (pillars.length <= 1) {
      setErrorNotice('Minimal harus memiliki 1 pilar konten.');
      return;
    }
    const next = [...pillars];
    next.splice(idx, 1);
    setPillars(next);
  };

  const handleResetPillars = () => {
    setPillars([...DEFAULT_CONTENT_PILLARS]);
    setSuccessNotice('Pilar dikembalikan ke daftar default rekomendasi.');
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  // Handler untuk Status Alur Kerja
  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newStatusTitle.trim();
    if (!title) return;

    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)+/g, '') || `status_${Date.now()}`;

    if (statuses.some((s) => s.id === id || s.title.toLowerCase() === title.toLowerCase())) {
      setErrorNotice(`Status "${title}" sudah ada.`);
      return;
    }

    const colorConfig = AVAILABLE_STATUS_COLORS[newStatusColorIndex] || AVAILABLE_STATUS_COLORS[0];
    const newCol: WorkflowStatusConfig = {
      id,
      title,
      dotColor: colorConfig.dot,
      headerBg: colorConfig.bg,
    };

    setStatuses([...statuses, newCol]);
    setNewStatusTitle('');
    setErrorNotice(null);
  };

  const handleRemoveStatus = (idx: number) => {
    if (statuses.length <= 2) {
      setErrorNotice('Kanban minimal membutuhkan 2 status alur kerja.');
      return;
    }
    const next = [...statuses];
    next.splice(idx, 1);
    setStatuses(next);
  };

  const handleMoveStatus = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= statuses.length) return;
    const next = [...statuses];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setStatuses(next);
  };

  const handleUpdateStatusColor = (idx: number, colorIdx: number) => {
    const color = AVAILABLE_STATUS_COLORS[colorIdx];
    if (!color) return;
    const next = [...statuses];
    next[idx] = {
      ...next[idx],
      dotColor: color.dot,
      headerBg: color.bg,
    };
    setStatuses(next);
  };

  const handleResetStatuses = () => {
    setStatuses([...DEFAULT_WORKFLOW_STATUSES]);
    setSuccessNotice('Status alur kerja dikembalikan ke alur standar.');
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  // Simpan perubahan ke database dan storage
  const handleSaveAll = async () => {
    setSaving(true);
    setErrorNotice(null);
    try {
      await workflowSettingsService.savePillars(brand.id, pillars);
      await workflowSettingsService.saveWorkflowStatuses(brand.id, statuses);

      setSuccessNotice('Pengaturan pilar & alur kerja berhasil disimpan!');
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Kustomisasi Pilar & Alur Kerja</h2>
              <p className="text-xs text-slate-500">
                Atur kategori konten dan tahapan alur kerja kanban khusus untuk <strong>{brand.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('pillars')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'pillars'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Pilar Konten ({pillars.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'workflow'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Columns className="w-4 h-4" />
            <span>Status Alur Kerja & Kanban ({statuses.length})</span>
          </button>
        </div>

        {/* Notifikasi feedback */}
        {successNotice && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}
        {errorNotice && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 animate-in fade-in shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}

        {/* Konten Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'pillars' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Daftar Pilar Konten Aktif</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Pilar ini akan otomatis muncul pada formulir pembuatan konten, edit postingan, filter database, dan kalender.
                </p>
              </div>

              {/* Form Tambah Pilar Baru */}
              <form onSubmit={handleAddPillar} className="flex gap-2">
                <input
                  type="text"
                  value={newPillarInput}
                  onChange={(e) => setNewPillarInput(e.target.value)}
                  placeholder="Nama pilar baru (contoh: Soft Selling, Q&A Komunitas, Tips Kilat)"
                  className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pilar</span>
                </button>
              </form>

              {/* List Pilar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {pillars.map((p, idx) => (
                  <div
                    key={`${p}-${idx}`}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs group hover:bg-white hover:shadow-xs transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">{p}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePillar(idx)}
                      title="Hapus pilar"
                      className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleResetPillars}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Kembalikan ke Default Pilar Rekomendasi</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Tahapan Alur Kerja (Workflow) & Kolom Kanban</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Kolom papan Kanban dan status konten akan otomatis mengikuti urutan dan nama yang Anda atur di sini. Anda dapat mengubah urutan atau warna kolom.
                </p>
              </div>

              {/* Form Tambah Status Alur Kerja */}
              <form onSubmit={handleAddStatus} className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Tambah Status Alur Kerja Baru:</span>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={newStatusTitle}
                    onChange={(e) => setNewStatusTitle(e.target.value)}
                    placeholder="Contoh: Produksi / Shooting, Editing Video, Revisi Klien"
                    className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  />
                  <div className="flex items-center gap-1.5 self-center">
                    <span className="text-[11px] text-slate-500 font-medium mr-1">Warna:</span>
                    {AVAILABLE_STATUS_COLORS.slice(0, 5).map((col, cIdx) => (
                      <button
                        key={col.label}
                        type="button"
                        onClick={() => setNewStatusColorIndex(cIdx)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition cursor-pointer ${
                          newStatusColorIndex === cIdx ? 'border-slate-800 scale-110' : 'border-transparent'
                        }`}
                        title={col.label}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full ${col.dot}`} />
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Status</span>
                  </button>
                </div>
              </form>

              {/* List Kolom Workflow */}
              <div className="space-y-2">
                {statuses.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStatus(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                          title="Geser ke kiri / urutan sebelumnya"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === statuses.length - 1}
                          onClick={() => handleMoveStatus(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                          title="Geser ke kanan / urutan selanjutnya"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${s.dotColor} shrink-0`} />
                        <span className="font-bold text-slate-800">{s.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({s.id})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Pemilih warna cepat */}
                      <div className="flex items-center gap-1">
                        {AVAILABLE_STATUS_COLORS.slice(0, 4).map((col, cIdx) => (
                          <button
                            key={col.label}
                            type="button"
                            onClick={() => handleUpdateStatusColor(idx, cIdx)}
                            className={`w-4 h-4 rounded-full ${col.dot} opacity-70 hover:opacity-100 hover:scale-110 transition cursor-pointer`}
                            title={col.label}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveStatus(idx)}
                        title="Hapus kolom ini dari Kanban"
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleResetStatuses}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Kembalikan ke Alur Kanban Standar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            Perubahan langsung aktif di Kanban, Kalender, dan Database Konten.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
