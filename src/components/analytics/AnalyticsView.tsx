import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  Calendar,
  Plus,
  Printer,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Building2,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Brand, ContentPost, ContentMetric } from '../../types/database.ts';
import { metricsService, AnalyticsReportData } from '../../services/database/metricsService.ts';
import { contentService } from '../../services/database/contentService.ts';
import { PerformanceComparisonCards } from './PerformanceComparisonCards.tsx';
import { TrendChart } from './TrendChart.tsx';
import { TopContentCard } from './TopContentCard.tsx';
import { PillarAnalysisCard } from './PillarAnalysisCard.tsx';
import { MetricHistoryTable } from './MetricHistoryTable.tsx';
import { FormulaExplanationCard } from './FormulaExplanationCard.tsx';
import { MetricInputModal } from './MetricInputModal.tsx';
import { InstagramInsightsCard } from './InstagramInsightsCard.tsx';
import { getBrandPlatforms, getPlatformName } from '../../config/platforms.ts';

interface AnalyticsViewProps {
  brand: Brand | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ brand }) => {
  const [periodDays, setPeriodDays] = useState<number | 'custom'>(30);
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [channel, setChannel] = useState<string>('all');
  const [reportData, setReportData] = useState<AnalyticsReportData | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [selectedMetricForEdit, setSelectedMetricForEdit] = useState<ContentMetric | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchData = useCallback(async () => {
    if (!brand) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [data, brandPosts] = await Promise.all([
        metricsService.getAnalyticsReport(
          brand.id,
          periodDays,
          channel,
          periodDays === 'custom' ? customStartDate : undefined,
          periodDays === 'custom' ? customEndDate : undefined
        ),
        contentService.getPosts(brand.id),
      ]);
      setReportData(data);
      setPosts(brandPosts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat analitik reporting.');
    } finally {
      setLoading(false);
    }
  }, [brand, periodDays, channel, customStartDate, customEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteMetric = async (id: string) => {
    if (!window.confirm('Hapus catatan metrik ini?')) return;
    try {
      await metricsService.deleteMetric(id);
      setNotice('Snapshot metrik berhasil dihapus.');
      await fetchData();
      setTimeout(() => setNotice(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus metrik.');
    }
  };

  const handlePrint = () => {
    setIsExportMenuOpen(false);
    window.print();
  };

  const exportToCSV = () => {
    setIsExportMenuOpen(false);
    if (!reportData || !brand) return;

    const headers = [
      'Waktu Snapshot',
      'Saluran Platform',
      'Judul Postingan',
      'Pilar Konten',
      'Impressions',
      'Reach',
      'Likes',
      'Comments',
      'Shares',
      'Saves',
      'Clicks',
      'Engagement Rate (%)',
      'Watch Time',
      'Drop-off Rate (%)',
      'Reposts',
      'Sumber Data',
    ];

    const rows = reportData.recentSnapshots.map((m) => {
      const raw = (m.raw_ai_analysis || {}) as Record<string, any>;
      const wt = m.watch_time || raw.watch_time || '';
      const dor = m.drop_off_rate ?? raw.drop_off_rate ?? '';
      const rep = m.reposts ?? raw.reposts ?? 0;

      return [
        `"${new Date(m.recorded_at).toLocaleString('id-ID')}"`,
        `"${m.channel}"`,
        `"${(m.post?.title || 'Metrik Umum Brand').replace(/"/g, '""')}"`,
        `"${(m.post?.pillar || '-').replace(/"/g, '""')}"`,
        m.impressions || 0,
        m.reach || 0,
        m.likes || 0,
        m.comments || 0,
        m.shares || 0,
        m.saves || 0,
        m.clicks || 0,
        m.engagement_rate || 0,
        `"${wt}"`,
        dor,
        rep,
        `"${m.source || 'manual'}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `laporan-analitik-${brand.name.toLowerCase().replace(/\s+/g, '-')}-${channel}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice('Data analitik berhasil diekspor ke file CSV.');
    setTimeout(() => setNotice(null), 3000);
  };

  const exportToExcel = () => {
    setIsExportMenuOpen(false);
    if (!reportData || !brand) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan Performa
    const comp = reportData.comparison;
    const summaryData = [
      ['LAPORAN ANALITIK MEDIA SOSIAL', brand.name],
      ['Periode Laporan', periodLabel],
      ['Saluran / Filter', channel === 'all' ? 'Semua Platform' : channel.toUpperCase()],
      ['Tanggal Unduh', new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })],
      [],
      ['Metrik Utama', 'Nilai Saat Ini', 'Periode Sebelumnya', 'Pertumbuhan (%)'],
      ['Total Impressions (Tayangan)', comp.current.totalImpressions, comp.previous.totalImpressions, `${comp.changes.impressionsPercent}%`],
      ['Total Reach (Jangkauan)', comp.current.totalReach, comp.previous.totalReach, `${comp.changes.reachPercent}%`],
      ['Total Engagements', comp.current.totalEngagements, comp.previous.totalEngagements, `${comp.changes.engagementsPercent}%`],
      ['Engagement Rate Rata-rata', `${comp.current.engagementRate}%`, `${comp.previous.engagementRate}%`, `${comp.changes.engagementRateDelta}% delta`],
      ['Total Suka (Likes)', comp.current.totalLikes, comp.previous.totalLikes, '-'],
      ['Total Komentar', comp.current.totalComments, comp.previous.totalComments, '-'],
      ['Total Dibagikan (Shares)', comp.current.totalShares, comp.previous.totalShares, `${comp.changes.sharesPercent}%`],
      ['Total Disimpan (Saves)', comp.current.totalSaves, comp.previous.totalSaves, `${comp.changes.savesPercent}%`],
      ['Total Klik Tautan (Clicks)', comp.current.totalClicks, comp.previous.totalClicks, '-'],
      ['Jumlah Postingan Aktif', comp.current.postCount, comp.previous.postCount, '-'],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Performa');

    // Sheet 2: Riwayat Snapshot Lengkap
    const snapshotRows = reportData.recentSnapshots.map((m) => {
      const raw = (m.raw_ai_analysis || {}) as Record<string, any>;
      return {
        'Waktu Snapshot': new Date(m.recorded_at).toLocaleString('id-ID'),
        'Saluran': m.channel.toUpperCase(),
        'Judul Postingan': m.post?.title || 'Metrik Umum Brand',
        'Pilar Konten': m.post?.pillar || '-',
        'Impressions': m.impressions || 0,
        'Reach': m.reach || 0,
        'Likes': m.likes || 0,
        'Comments': m.comments || 0,
        'Shares': m.shares || 0,
        'Saves': m.saves || 0,
        'Clicks': m.clicks || 0,
        'Engagement Rate (%)': m.engagement_rate || 0,
        'Watch Time': m.watch_time || raw.watch_time || '-',
        'Drop-off Rate (%)': m.drop_off_rate ?? raw.drop_off_rate ?? '-',
        'Reposts': m.reposts ?? raw.reposts ?? 0,
        'Sumber': m.source === 'ai_screenshot' ? 'AI Extractor' : 'Manual Input',
      };
    });
    const wsSnapshots = XLSX.utils.json_to_sheet(snapshotRows);
    XLSX.utils.book_append_sheet(wb, wsSnapshots, 'Riwayat Snapshot');

    // Sheet 3: Performa Pilar
    if (reportData.pillarPerformances.length > 0) {
      const pillarRows = reportData.pillarPerformances.map((p) => ({
        'Pilar Konten': p.pillar,
        'Jumlah Postingan': p.postCount,
        'Total Reach': p.totalReach,
        'Total Engagements': p.totalEngagements,
        'Rata-rata ER (%)': p.averageER,
      }));
      const wsPillars = XLSX.utils.json_to_sheet(pillarRows);
      XLSX.utils.book_append_sheet(wb, wsPillars, 'Performa Pilar');
    }

    // Write workbook
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `laporan-analitik-${brand.name.toLowerCase().replace(/\s+/g, '-')}-${channel}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice('Data analitik berhasil diekspor ke file Excel (.xlsx).');
    setTimeout(() => setNotice(null), 3000);
  };

  if (!brand) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto">
        <BarChart3 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800">Pilih atau buat brand terlebih dahulu</p>
      </div>
    );
  }

  const periodLabel = periodDays === 7 
    ? '7 Hari Terakhir' 
    : periodDays === 30 
    ? '30 Hari Terakhir' 
    : periodDays === 90 
    ? '90 Hari Terakhir' 
    : `Custom (${customStartDate} s/d ${customEndDate})`;

  return (
    <div className="space-y-6">
      {/* Print Stylesheet Injection */}
      <style>{`
        @media print {
          body { background: white !important; font-size: 11pt; }
          header, aside, .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      {/* View Header with Period & Action Buttons */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">Analitik & Reporting</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                {brand.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Agregasi performa, perbandingan periode historis, engagement rate, dan laporan eksekutif
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector Tabs */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
            {[7, 30, 90, 'custom'].map((d) => (
              <button
                key={String(d)}
                onClick={() => setPeriodDays(d as number | 'custom')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition cursor-pointer capitalize ${
                  periodDays === d
                    ? 'bg-white text-blue-600 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d === 'custom' ? 'Custom' : `${d} Hari`}
              </button>
            ))}
          </div>

          {/* Custom Date Range Inputs */}
          {periodDays === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
              <span className="text-slate-500 font-medium">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800"
              />
              <span className="text-slate-500 font-medium">S/d:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800"
              />
            </div>
          )}

          {/* Channel Filter Pills mengikuti platform yang dipilih brand */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
            {[
              { id: 'all', label: 'Semua' },
              ...getBrandPlatforms(brand).map((platformId) => ({
                id: platformId,
                label: getPlatformName(platformId),
              })),
            ].map((ch) => (
              <button
                key={ch.id}
                onClick={() => setChannel(ch.id)}
                className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                  channel === ch.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Export Dropdown Menu (Pilihan Excel, CSV, PDF) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
              title="Pilih Format Ekspor Data"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Ekspor</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 text-xs animate-in fade-in">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
                  Format Laporan
                </div>
                <button
                  onClick={exportToExcel}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold block">Microsoft Excel (.xlsx)</span>
                    <span className="text-[10px] text-slate-400 block">Laporan multi-sheet lengkap</span>
                  </div>
                </button>
                <button
                  onClick={exportToCSV}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-semibold block">File CSV (.csv)</span>
                    <span className="text-[10px] text-slate-400 block">Kompatibel spreadsheet</span>
                  </div>
                </button>
                <button
                  onClick={handlePrint}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition cursor-pointer border-t border-slate-100"
                >
                  <Printer className="w-4 h-4 text-slate-600 shrink-0" />
                  <div>
                    <span className="font-semibold block">Cetak / Simpan PDF</span>
                    <span className="text-[10px] text-slate-400 block">Tampilan dokumen cetak</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Button Catat Metrik */}
          <button
            onClick={() => {
              setSelectedMetricForEdit(null);
              setIsInputModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Catat Metrik</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header (Visible only when printing) */}
      <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Laporan Analitik Media Sosial</h1>
            <p className="text-sm text-slate-600">Brand: <strong>{brand.name}</strong> • Periode: {periodLabel}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Dihasilkan oleh ZaFlow Platform</p>
            <p>{new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-800 animate-in fade-in no-print">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700 no-print">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchData} className="font-semibold underline cursor-pointer">
            Coba Lagi
          </button>
        </div>
      )}

      {/* Formula Explanation Card (No print or clean print) */}
      <div className="no-print">
        <FormulaExplanationCard />
      </div>

      {/* Main Reporting Sections */}
      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-16 text-center shadow-xs">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Memproses kalkulasi analitik dan agregasi historis...</p>
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* 1. Period Comparison Stat Cards */}
          <PerformanceComparisonCards
            comparison={reportData.comparison}
            periodLabel={periodLabel}
          />

          {/* 2. Interactive Historical Trend Chart */}
          <TrendChart data={reportData.dailyTrends} />

          {/* 2.5 Analisis Mendalam Instagram (Hanya tampil saat filter Instagram dipilih) */}
          {channel === 'instagram' && (
            <InstagramInsightsCard
              reportData={reportData}
              channel="instagram"
              onOpenRecord={() => {
                setSelectedMetricForEdit(null);
                setIsInputModalOpen(true);
              }}
            />
          )}

          {/* 3. Top Content & Pillar Performance Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <TopContentCard
                topPosts={reportData.topPosts}
              />
            </div>
            <div className="lg:col-span-5">
              <PillarAnalysisCard
                pillars={reportData.pillarPerformances}
              />
            </div>
          </div>

          {/* 4. Metric Snapshot History Table */}
          <div className="no-print">
            <MetricHistoryTable
              snapshots={reportData.recentSnapshots}
              onEdit={(metric) => {
                setSelectedMetricForEdit(metric);
                setIsInputModalOpen(true);
              }}
              onDelete={handleDeleteMetric}
            />
          </div>
        </div>
      ) : null}

      {/* Modal Input & Edit Metrik */}
      <MetricInputModal
        isOpen={isInputModalOpen}
        brandId={brand.id}
        posts={posts}
        platforms={getBrandPlatforms(brand)}
        initialMetric={selectedMetricForEdit}
        onClose={() => {
          setIsInputModalOpen(false);
          setSelectedMetricForEdit(null);
        }}
        onSaved={fetchData}
      />
    </div>
  );
};
