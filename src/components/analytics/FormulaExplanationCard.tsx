import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Calculator, ShieldCheck } from 'lucide-react';

export const FormulaExplanationCard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-xl overflow-hidden transition-all text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100/60 transition cursor-pointer"
      >
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span>Panduan Rumus & Definisi Indikator Metrik (Transparan & Anti-Error)</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500 text-xs">
          <span>{isOpen ? 'Tutup Penjelasan' : 'Lihat Rumus'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-slate-200/60 space-y-3 bg-white text-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Total Keterlibatan (Engagements)
              </p>
              <p className="font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                Likes + Comments + Shares + Saves
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Total akumulasi seluruh aksi interaksi aktif yang dilakukan audiens pada postingan.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Engagement Rate (ER by Reach)
              </p>
              <p className="font-mono text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                (Total Engagements / Reach) × 100%
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Mengukur persentase audiens unik yang terdorong berinteraksi setelah melihat konten.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Save Rate (% Simpan)
              </p>
              <p className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                (Saves / Reach) × 100%
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Indikator konten bernilai tinggi (*evergreen/reference*). Metrik favorit algoritma Instagram & TikTok.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Share Rate (% Bagikan)
              </p>
              <p className="font-mono text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                (Shares / Reach) × 100%
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Indikator viralitas dan *word-of-mouth*. Mengukur potensi konten menjangkau audiens baru secara organik.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Perubahan Tren (Period-over-Period)
              </p>
              <p className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                ((Periode Kini - Periode Lalu) / Periode Lalu) × 100%
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Menghitung laju pertumbuhan performa akun secara komparatif terhadap rentang hari sebelumnya.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Penanganan Nilai Kosong (Zero Division)
              </p>
              <p className="font-mono text-[11px] text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded">
                safeDivision(num, den) = den &gt; 0 ? (num/den) : 0
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Sistem secara otomatis menangani nilai 0 dan data kosong untuk mencegah error <code className="text-red-600">NaN</code> atau <code className="text-red-600">Infinity</code>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
