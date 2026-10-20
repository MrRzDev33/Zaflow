import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, Terminal, ExternalLink, ChevronDown, ChevronUp, Key, Settings } from 'lucide-react';
import { isConfigured } from '../../config/supabase.ts';
import { getStoredSupabaseConfig } from '../../config/env.ts';

export const ConfigNotice: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  const stored = getStoredSupabaseConfig();
  const [urlInput, setUrlInput] = useState(stored.url);
  const [keyInput, setKeyInput] = useState(stored.anonKey);

  if (isConfigured) return null;

  const copySqlLocation = () => {
    navigator.clipboard.writeText('src/services/database/schema.sql');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !keyInput.trim()) {
      alert('URL dan Anon Key wajib diisi.');
      return;
    }
    localStorage.setItem('ZAFLOW_SUPABASE_URL', urlInput.trim());
    localStorage.setItem('ZAFLOW_SUPABASE_ANON_KEY', keyInput.trim());
    window.location.reload();
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm sm:text-base text-amber-950">
                Supabase Belum Dikonfigurasi
              </p>
              <p className="text-xs sm:text-sm text-amber-800 mt-0.5">
                Isi <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">VITE_SUPABASE_URL</code> dan <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> di <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">.env.local</code> (root proyek), lalu restart <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">npm run dev</code>. Untuk server, isi juga <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> di file yang sama.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Atur Kunci Supabase</span>
            </button>
            <button
              onClick={() => setShowSqlGuide(!showSqlGuide)}
              className="text-xs font-medium text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Panduan SQL</span>
              {showSqlGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showSqlGuide && (
          <div className="mt-3 pt-3 border-t border-amber-200/70 text-xs sm:text-sm text-amber-900 space-y-2">
            <p className="font-medium">Cara Menyiapkan Database:</p>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-amber-800">
              <li>
                Buka <strong>Supabase Dashboard</strong> &rarr; Proyek Anda &rarr; <strong>Project Settings</strong> &rarr; <strong>API</strong>.
              </li>
              <li>
                Salin <strong>Project URL</strong> dan <strong>anon key</strong>, lalu masukkan lewat tombol <strong>"Atur Kunci Supabase"</strong> di atas.
              </li>
              <li>
                Jalankan berkas <code className="bg-amber-100 px-1 rounded">src/services/database/schema.sql</code> untuk membuat tabel dasar.
              </li>
              <li>
                Lalu jalankan migrasi berurutan di <strong>SQL Editor</strong>:
                <code className="bg-amber-100 px-1 rounded">migrations/20261013_01_security_hardening_profiles_and_brands.sql</code>,
                <code className="bg-amber-100 px-1 rounded">migrations/20261013_02_create_brand_invitations_and_activity_logs.sql</code>, dan
                <code className="bg-amber-100 px-1 rounded">migrations/20261020_01_licensing_payments_limits_and_rpc.sql</code>.
              </li>
            </ol>
          </div>
        )}
      </div>

      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold flex items-center gap-2 text-slate-900">
                <Settings className="w-5 h-5 text-blue-600" />
                <span>Konfigurasi Supabase Kredensial</span>
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supabase Project URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://xxxxxx.supabase.co"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supabase Anon / Public Key</label>
                <textarea
                  required
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-blue-600"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                Kredensial ini hanya disimpan di browser (<code className="font-mono">localStorage</code>) dan hanya menghubungkan <strong>frontend</strong> ke Supabase. Backend tetap memerlukan <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> di <code className="font-mono">.env.local</code> agar fitur admin, AI, pembayaran, dan undangan berfungsi.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Simpan & Hubungkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
