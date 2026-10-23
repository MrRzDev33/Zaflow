import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Link2, RotateCcw, Upload } from 'lucide-react';
import { useAppBranding } from '../../hooks/useAppBranding.ts';
import { ZaFlowLogo } from '../common/ZaFlowLogo.tsx';

export const AdminBrandingPanel: React.FC = () => {
  const { logoUrl, updateLogoUrl, uploadLogoFile, resetLogo, isCustomLogo } = useAppBranding();
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [inputUrl, setInputUrl] = useState(logoUrl || '');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputUrl(logoUrl || '');
  }, [logoUrl]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Pilih file gambar yang valid.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Ukuran gambar maksimal 2 MB.' });
      return;
    }
    setProcessing(true);
    setFeedback(null);
    try {
      await uploadLogoFile(file);
      setFeedback({ type: 'success', message: 'Logo berhasil diperbarui.' });
    } catch (error: any) {
      setFeedback({ type: 'error', message: error?.message || 'Logo belum dapat diunggah.' });
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleUrl = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputUrl.trim()) {
      setFeedback({ type: 'error', message: 'Masukkan tautan gambar logo.' });
      return;
    }
    updateLogoUrl(inputUrl.trim());
    setFeedback({ type: 'success', message: 'Logo berhasil diperbarui.' });
  };

  const handleReset = () => {
    resetLogo();
    setInputUrl('');
    setFeedback({ type: 'success', message: 'Logo dikembalikan ke tampilan bawaan.' });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Identitas Aplikasi</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Atur logo yang tampil di navigasi dan halaman masuk.
            </p>
          </div>
          {isCustomLogo && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Kembalikan Logo Bawaan
            </button>
          )}
        </div>

        {feedback && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="inline-flex rounded-xl border border-black/[0.06] bg-slate-100 p-1 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${mode === 'upload' ? 'bg-white text-slate-900 shadow-sm' : ''}`}
              >
                <Upload className="h-3.5 w-3.5" />
                Unggah File
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${mode === 'url' ? 'bg-white text-slate-900 shadow-sm' : ''}`}
              >
                <Link2 className="h-3.5 w-3.5" />
                Tautan Gambar
              </button>
            </div>

            {mode === 'upload' ? (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleFile}
                  className="hidden"
                  id="admin-logo-upload"
                />
                <label
                  htmlFor="admin-logo-upload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <ImagePlus className="mb-2 h-6 w-6 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">
                    {processing ? 'Mengunggah...' : 'Pilih gambar logo'}
                  </span>
                  <span className="mt-1 text-[10px] text-slate-400">PNG, JPG, SVG, atau WebP. Maksimal 2 MB.</span>
                </label>
              </div>
            ) : (
              <form onSubmit={handleUrl} className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Tautan gambar logo</label>
                <div className="flex gap-2">
                  <input
                    value={inputUrl}
                    onChange={(event) => setInputUrl(event.target.value)}
                    placeholder="https://contoh.com/logo.png"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-slate-50 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pratinjau</p>
            <div className="flex items-center justify-center rounded-xl bg-[#18181B] p-5">
              <ZaFlowLogo size="md" showText={true} theme="dark" customLogoUrl={logoUrl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
