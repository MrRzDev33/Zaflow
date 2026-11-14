import React, { useState } from 'react';
import {
  BrainCircuit,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  Target,
  Plus,
  ShieldCheck,
  TrendingUp,
  BookmarkCheck,
  Calendar,
  Layers,
  MessageCircle,
} from '../common/icons/lucide-compat.tsx';
import { Brand, ContentPost } from '../../types/database.ts';
import { aiClientService, StrategyResultData, ContentActionPlanItem } from '../../services/ai/aiClientService.ts';
import { getBrandPlatforms, getPlatformName } from '../../config/platforms.ts';
import { workflowSettingsService } from '../../services/database/workflowSettingsService.ts';
import { AiChatPanel } from './AiChatPanel.tsx';

interface AiStrategyAssistantViewProps {
  brand: Brand | null;
  posts: ContentPost[];
  aiCreditsRemaining: number;
  aiCreditsUnlimited?: boolean;
  onRefreshLicense: () => void;
  onSelectActionPlanItem: (item: ContentActionPlanItem) => void;
}

const DEFAULT_OBJECTIVES = [
  'Tingkatkan Engagement Rate & Diskusi Komentar',
  'Perbanyak Saves / Bookmark (Konten Bernilai Simpan Tinggi)',
  'Perluas Reach Organik & Jangkauan Audiens Baru',
  'Optimasi Frekuensi & Format Konten (Carousel vs Reels)',
  'Konversi Penjualan & Promosi Halus (Soft Selling)',
];

type PeriodMode = 'all' | 'month' | 'range';

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const AiStrategyAssistantView: React.FC<AiStrategyAssistantViewProps> = ({
  brand,
  posts,
  aiCreditsRemaining,
  aiCreditsUnlimited = false,
  onRefreshLicense,
  onSelectActionPlanItem,
}) => {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([DEFAULT_OBJECTIVES[0]]);
  const [goalOptions, setGoalOptions] = useState<string[]>(DEFAULT_OBJECTIVES);
  const [customGoalInput, setCustomGoalInput] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [periodMonth, setPeriodMonth] = useState(currentMonthValue());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategyResult, setStrategyResult] = useState<StrategyResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generator' | 'chat'>('generator');

  const brandPlatforms = getBrandPlatforms(brand);
  const brandPillars = workflowSettingsService.getPillars(brand);
  const effectivePlatforms = selectedPlatforms.length > 0 ? selectedPlatforms : brandPlatforms;

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((item) => item !== goal) : [...prev, goal]
    );
  };

  const addCustomGoal = () => {
    const value = customGoalInput.trim();
    if (!value) return;

    setGoalOptions((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setSelectedGoals((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setCustomGoalInput('');
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform]
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;

    const pendingGoal = customGoalInput.trim();
    const goalsForRequest =
      pendingGoal && !selectedGoals.includes(pendingGoal)
        ? [...selectedGoals, pendingGoal]
        : selectedGoals;

    if (goalsForRequest.length === 0) {
      setError('Pilih minimal satu fokus sasaran strategi, atau tambahkan sasaran sendiri.');
      return;
    }

    if (pendingGoal) {
      setGoalOptions((prev) => (prev.includes(pendingGoal) ? prev : [...prev, pendingGoal]));
      setSelectedGoals(goalsForRequest);
      setCustomGoalInput('');
    }

    if (periodMode === 'month' && !periodMonth) {
      setError('Pilih bulan analisis terlebih dahulu.');
      return;
    }

    if (periodMode === 'range') {
      if (!startDate || !endDate) {
        setError('Lengkapi tanggal awal dan tanggal akhir untuk periode rentang.');
        return;
      }
      if (startDate > endDate) {
        setError('Tanggal awal tidak boleh melewati tanggal akhir.');
        return;
      }
    }

    if (!aiCreditsUnlimited && aiCreditsRemaining <= 0) {
      setError('Kuota kredit AI Anda telah habis. Silakan periksa halaman Paket & Kuota.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const response = await aiClientService.generateStrategyAdvice(
        brand.id,
        goalsForRequest.join('; '),
        customNotes.trim() || undefined,
        {
          goals: goalsForRequest,
          platforms: effectivePlatforms,
          pillars: workflowSettingsService.getConfiguredPillars(brand),
          periodMode,
          periodMonth: periodMode === 'month' ? periodMonth : undefined,
          startDate: periodMode === 'range' ? startDate : undefined,
          endDate: periodMode === 'range' ? endDate : undefined,
        }
      );

      setStrategyResult(response.strategy);
      setSuccessNotice('Rekomendasi strategi AI berhasil dirumuskan berdasarkan data historis!');
      onRefreshLicense();
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: unknown) {
      onRefreshLicense();
      setError(err instanceof Error ? err.message : 'Gagal menghasilkan strategi AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!brand) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto">
        <BrainCircuit className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800">Pilih atau buat brand terlebih dahulu</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">AI Strategy Assistant</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Berbasis Data Historis Terverifikasi
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Menganalisis performa konten masa lalu untuk merumuskan pilar, hook, dan format berkinerja tinggi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shrink-0 self-start md:self-auto text-xs">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="text-slate-600">Sisa Kuota AI:</span>
          <span className="font-bold text-slate-900">
            {aiCreditsUnlimited ? '∞ Unlimited' : `${aiCreditsRemaining} Kredit`}
          </span>
        </div>
      </div>

      {/* Tab: Generator Strategi | Chat Konsultasi */}
      <div className="flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('generator')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
            activeTab === 'generator'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
          aria-pressed={activeTab === 'generator'}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generator Strategi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
          aria-pressed={activeTab === 'chat'}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Chat Konsultasi
        </button>
      </div>

      {activeTab === 'chat' ? (
        <AiChatPanel
          brand={brand}
          onRefreshLicense={onRefreshLicense}
        />
      ) : (
        <>
      {/* Notifications */}
      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Two Column Layout: Generator Setup (Left) & Strategy Report (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Context & Form (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Historical Context Badge */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Konteks Data Terotorisasi</span>
            </h2>
            <div className="text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2.5">
              <p>Workspace: <strong className="text-slate-900">{brand.name}</strong></p>
              <p>Industri: <strong className="text-slate-900">{brand.industry || 'Umum'}</strong></p>
              <p>Pilar aktif: <strong className="text-slate-900">{brandPillars.join(', ') || 'Belum diatur'}</strong></p>
              <p>Postingan di koleksi konten: <strong className="text-slate-900">{posts.length} post</strong></p>
            </div>
          </div>

          {/* Form Generator */}
          <form onSubmit={handleGenerate} className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Konfigurasi Tujuan Analisis</h2>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Fokus Sasaran Strategi *
                </label>
                <span className="text-[10px] text-slate-400">
                  {selectedGoals.length} dipilih
                </span>
              </div>
              <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
                Pilih satu atau beberapa sasaran. Anda juga bisa menambahkan sasaran sendiri.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {goalOptions.map((goal) => {
                  const active = selectedGoals.includes(goal);
                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => toggleGoal(goal)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2 py-1 text-left text-[11px] transition ${
                        active
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      {active ? '✓ ' : ''}
                      {goal}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={customGoalInput}
                  onChange={(e) => setCustomGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomGoal();
                    }
                  }}
                  placeholder="Tambah sasaran sendiri, mis. naikkan CTR link bio"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addCustomGoal}
                  disabled={!customGoalInput.trim()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Platform yang Dianalisis
              </label>
              <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
                Kosongkan pilihan untuk menganalisis semua platform yang terhubung ke brand.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedPlatforms([])}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                    selectedPlatforms.length === 0
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Semua Platform
                </button>
                {brandPlatforms.map((platform) => {
                  const active = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                        active
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {getPlatformName(platform)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                Cakupan: {effectivePlatforms.map((platform) => getPlatformName(platform)).join(', ')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Periode Analisis
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  ['all', 'Semua'],
                  ['month', 'Bulan'],
                  ['range', 'Rentang'],
                ] as Array<[PeriodMode, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPeriodMode(mode)}
                    aria-pressed={periodMode === mode}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                      periodMode === mode
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {periodMode === 'month' && (
                <input
                  type="month"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}

              {periodMode === 'range' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="mb-0.5 block text-[10px] text-slate-500">Dari tanggal</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[10px] text-slate-500">Sampai tanggal</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                Analisis mengikuti jadwal posting (tanggal & jam), bukan tanggal snapshot metrik.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                rows={3}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Contoh: Fokuskan pada target audiens usia 20-30 tahun, gaya bahasa santai..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating || (!aiCreditsUnlimited && aiCreditsRemaining <= 0)}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Merumuskan Strategi dengan AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Hasilkan Strategi AI (1 Kredit)</span>
                </>
              )}
            </button>
          </form>

          {/* Disclaimer Transparency */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-800 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              Pemisahan Fakta vs Rekomendasi
            </p>
            <p className="leading-relaxed">
              Sistem ini membedakan secara tegas antara <strong>fakta historis nyata</strong> dari data brand Anda dan <strong>rekomendasi berbasis AI</strong>. AI tidak menjamin 100% viralitas otomatis.
            </p>
          </div>
        </div>

        {/* Right Column: Strategy Report & Content Action Plan (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {!strategyResult ? (
            <div className="bg-white border border-slate-200/80 rounded-xl p-16 text-center shadow-xs space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Belum Ada Rekomendasi Strategi yang Dibuat</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Pilih fokus sasaran strategi di sebelah kiri dan klik "Hasilkan Strategi AI" untuk memulai analisis mendalam.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Brand Overview Card */}
              {strategyResult.brand_overview && (
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-2">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ringkasan Posisi Brand
                  </h2>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {strategyResult.brand_overview}
                  </p>
                </div>
              )}

              {/* 1. Verified Historical Facts Section */}
              <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold">1. Fakta Historis Terverifikasi (Data Nyata)</h2>
                </div>
                <div className="space-y-2">
                  {strategyResult.verified_historical_facts.map((fact, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-emerald-950 bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                      <span className="font-bold text-emerald-600 shrink-0">✓</span>
                      <span>{fact}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Key Insights & Patterns */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <h2 className="text-sm font-bold">2. Temuan Pola & Wawasan Kunci</h2>
                </div>
                <div className="space-y-2">
                  {strategyResult.key_insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="font-bold text-purple-600 shrink-0">•</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Strategic Actionable Recommendations */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <Target className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold">3. Rekomendasi Aksi Strategis</h2>
                </div>
                <div className="space-y-2">
                  {strategyResult.strategic_recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-800 bg-blue-50/40 p-2.5 rounded-lg border border-blue-100">
                      <span className="font-extrabold text-blue-600 shrink-0">{i + 1}.</span>
                      <span className="font-medium">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Content Action Plan Cards */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-bold">4. Rencana Ide Konten Praktis (Action Plan)</h2>
                  </div>
                  <span className="text-xs text-slate-500">
                    {strategyResult.content_action_plan.length} Ide Hook
                  </span>
                </div>

                <div className="space-y-3">
                  {strategyResult.content_action_plan.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 transition-all bg-slate-50/50 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 text-xs">
                            "{item.hook}"
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {item.rationale}
                          </p>
                        </div>

                        <button
                          onClick={() => onSelectActionPlanItem(item)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 shadow-2xs transition cursor-pointer"
                          title="Gunakan ide ini untuk membuat postingan baru"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Buat Konten</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-700">
                          Pilar: <strong>{item.pillar}</strong>
                        </span>
                        <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                          Format: <strong>{item.format}</strong>
                        </span>
                        <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          {item.channel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer Notice */}
              <div className="p-3 bg-slate-100 rounded-xl text-center text-[11px] text-slate-500">
                {strategyResult.disclaimer}
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
