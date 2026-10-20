/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Sparkles, BarChart3, ScanEye, BrainCircuit, Users, History, Key, ShieldAlert } from 'lucide-react';
import { useAuth } from './hooks/useAuth.ts';
import { useBrands } from './hooks/useBrands.ts';
import { useLicense } from './hooks/useLicense.ts';
import { AuthPage } from './components/auth/AuthPage.tsx';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { DashboardOverview } from './components/dashboard/DashboardOverview.tsx';
import { ContentDatabaseView } from './components/content/ContentDatabaseView.tsx';
import { ContentCalendarView } from './components/content/ContentCalendarView.tsx';
import { ContentKanbanView } from './components/content/ContentKanbanView.tsx';
import { CrudTestPanel } from './components/content/CrudTestPanel.tsx';
import { AnalyticsView } from './components/analytics/AnalyticsView.tsx';
import { ContentPostAnalyticsView } from './components/analytics/ContentPostAnalyticsView.tsx';
import { AiMetricsExtractorView } from './components/ai/AiMetricsExtractorView.tsx';
import { AiStrategyAssistantView } from './components/ai/AiStrategyAssistantView.tsx';
import { NewBrandModal } from './components/dashboard/NewBrandModal.tsx';
import { NewPostModal } from './components/dashboard/NewPostModal.tsx';
import { BrandSettingsModal } from './components/brands/BrandSettingsModal.tsx';
import { TeamView } from './components/team/TeamView.tsx';
import { ActivityLogsView } from './components/activity/ActivityLogsView.tsx';
import { LicenseQuotaView } from './components/license/LicenseQuotaView.tsx';
import { AdminPanelView } from './components/admin/AdminPanelView.tsx';
import { contentService, CreatePostInput } from './services/database/contentService.ts';
import { teamService } from './services/database/teamService.ts';
import { ContentPost, ContentFormat } from './types/database.ts';
import { ContentActionPlanItem } from './services/ai/aiClientService.ts';

export default function App() {
  const {
    user,
    profile,
    loading: authLoading,
    passwordRecovery,
    completePasswordRecovery,
    signOut,
  } = useAuth();
  const {
    brands,
    activeBrand,
    activeRole,
    setActiveBrandId,
    createBrand,
    refreshBrands,
  } = useBrands(user?.id);

  const {
    aiCreditsRemaining,
    aiCreditsTotal,
    maxBrands,
    refreshLicense,
  } = useLicense(user?.id);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isNewBrandOpen, setIsNewBrandOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isBrandSettingsOpen, setIsBrandSettingsOpen] = useState(false);
  const [brandPosts, setBrandPosts] = useState<ContentPost[]>([]);
  const [aiTargetPostId, setAiTargetPostId] = useState<string | null>(null);

  // State untuk prefill konten dari ide AI Strategy Assistant
  const [prefillPost, setPrefillPost] = useState<{
    title: string;
    pillar: string;
    format: ContentFormat;
    caption: string;
  } | null>(null);

  // Deteksi token undangan dari query param (?invite_token=...) atau localStorage
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('invite_token');
    const fromStorage = localStorage.getItem('zaflow_pending_invite_token');
    const token = fromUrl || fromStorage;
    if (fromUrl) {
      localStorage.setItem('zaflow_pending_invite_token', fromUrl);
    }
    return token;
  });
  const [invitePreview, setInvitePreview] = useState<{
    brand_name?: string;
    role?: string;
    email_masked?: string;
    is_expired?: boolean;
  } | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const isSuperAdmin = profile?.system_role === 'super_admin';
  const canEditContent = activeRole === 'owner' || activeRole === 'admin' || activeRole === 'editor';
  const canDeleteContent = activeRole === 'owner' || activeRole === 'admin';
  const canManageTeam = activeRole === 'owner' || activeRole === 'admin';
  const atBrandLimit = maxBrands > 0 && brands.length >= maxBrands;

  const handleOpenNewBrand = useCallback(() => {
    if (atBrandLimit) {
      setCurrentTab('license');
      return;
    }
    setIsNewBrandOpen(true);
  }, [atBrandLimit]);

  useEffect(() => {
    if (currentTab === 'admin' && !isSuperAdmin) {
      setCurrentTab('dashboard');
    }
  }, [currentTab, isSuperAdmin]);

  useEffect(() => {
    if (currentTab !== 'ai_extractor') {
      setAiTargetPostId(null);
    }
  }, [currentTab]);

  useEffect(() => {
    if (inviteToken) {
      teamService.getInvitationPreview(inviteToken).then((info) => {
        if (info) setInvitePreview(info);
      }).catch(() => {});
    }
  }, [inviteToken]);

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setAcceptingInvite(true);
    try {
      const res = await teamService.acceptInvitation(inviteToken);
      setInviteFeedback({ success: true, message: res.message });
      localStorage.removeItem('zaflow_pending_invite_token');
      await refreshBrands();
      if (res.brand_id) {
        setActiveBrandId(res.brand_id);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('invite_token');
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => {
        setInviteToken(null);
        setInviteFeedback(null);
      }, 2500);
    } catch (err: any) {
      setInviteFeedback({ success: false, message: err.message || 'Gagal menerima undangan.' });
    } finally {
      setAcceptingInvite(false);
    }
  };

  const handleDismissInvite = () => {
    localStorage.removeItem('zaflow_pending_invite_token');
    const url = new URL(window.location.href);
    url.searchParams.delete('invite_token');
    window.history.replaceState({}, '', url.toString());
    setInviteToken(null);
    setInviteFeedback(null);
  };

  const fetchBrandPosts = useCallback(async () => {
    if (!activeBrand) {
      setBrandPosts([]);
      return;
    }
    try {
      const list = await contentService.getPosts(activeBrand.id);
      setBrandPosts(list);
    } catch {
      // ignore
    }
  }, [activeBrand]);

  useEffect(() => {
    fetchBrandPosts();
  }, [fetchBrandPosts]);

  // Loading screen saat memverifikasi sesi
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-800">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="font-semibold text-sm">Memuat ZaFlow...</span>
        </div>
      </div>
    );
  }

  // Tampilkan form pembuatan kata sandi baru setelah pengguna membuka tautan recovery.
  if (passwordRecovery) {
    return <ResetPasswordForm onComplete={completePasswordRecovery} />;
  }

  // Jika belum masuk, tampilkan portal autentikasi
  if (!user) {
    return <AuthPage />;
  }

  const handleCreatePost = async (input: CreatePostInput) => {
    await contentService.createPost(input);
    fetchBrandPosts();
    refreshBrands();
    refreshLicense();
  };

  const handleSelectActionPlanItem = (item: ContentActionPlanItem) => {
    setPrefillPost({
      title: item.hook,
      pillar: item.pillar,
      format: (item.format as ContentFormat) || 'carousel',
      caption: `Ide dari AI Strategy: ${item.rationale}`,
    });
    setIsNewPostOpen(true);
  };

  return (
    <>
      <AppLayout
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        brands={brands}
        activeBrand={activeBrand}
        profile={profile}
        isSuperAdmin={isSuperAdmin}
        aiCreditsRemaining={aiCreditsRemaining}
        aiCreditsTotal={aiCreditsTotal}
        onSelectBrand={setActiveBrandId}
        onOpenNewBrand={handleOpenNewBrand}
        canCreateBrand={!atBrandLimit}
        onOpenBrandSettings={canManageTeam ? () => setIsBrandSettingsOpen(true) : undefined}
        onOpenNewPost={() => {
          setPrefillPost(null);
          setIsNewPostOpen(true);
        }}
        onSignOut={signOut}
      >
        {currentTab === 'dashboard' && (
          <DashboardOverview
            brand={activeBrand}
            aiCreditsRemaining={aiCreditsRemaining}
            onOpenNewPost={() => {
              setPrefillPost(null);
              setIsNewPostOpen(true);
            }}
            onOpenNewBrand={handleOpenNewBrand}
            onSelectTab={setCurrentTab}
          />
        )}

        {currentTab === 'content_db' && (
          <ContentDatabaseView
            brand={activeBrand}
            canEdit={canEditContent}
            canDelete={canDeleteContent}
            onOpenNewPost={() => {
              setPrefillPost(null);
              setIsNewPostOpen(true);
            }}
          />
        )}

        {currentTab === 'calendar' && (
          <ContentCalendarView
            brand={activeBrand}
            canEdit={canEditContent}
          />
        )}

        {currentTab === 'kanban' && (
          <ContentKanbanView
            brand={activeBrand}
            canEdit={canEditContent}
            canDelete={canDeleteContent}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView
            brand={activeBrand}
          />
        )}

        {currentTab === 'content_posts' && (
          <ContentPostAnalyticsView
            brand={activeBrand}
            posts={brandPosts}
            canEdit={canEditContent}
            onRefreshPosts={fetchBrandPosts}
            onOpenAiExtractor={(postId) => {
              setAiTargetPostId(postId);
              setCurrentTab('ai_extractor');
            }}
          />
        )}

        {currentTab === 'ai_extractor' && (
          canEditContent ? (
            <AiMetricsExtractorView
              brand={activeBrand}
              posts={brandPosts}
              aiCreditsRemaining={aiCreditsRemaining}
              initialPostId={aiTargetPostId}
              onRefreshLicense={refreshLicense}
              onSavedMetrics={() => {
                fetchBrandPosts();
                refreshLicense();
              }}
            />
          ) : (
            <RestrictedNotice
              title="Akses Metrics Extractor dibatasi"
              message="Role Viewer hanya dapat melihat data. Minta owner/admin menaikkan akses Anda menjadi Editor untuk memakai fitur AI."
            />
          )
        )}

        {currentTab === 'ai_strategy' && (
          canEditContent ? (
            <AiStrategyAssistantView
              brand={activeBrand}
              posts={brandPosts}
              aiCreditsRemaining={aiCreditsRemaining}
              onRefreshLicense={refreshLicense}
              onSelectActionPlanItem={handleSelectActionPlanItem}
            />
          ) : (
            <RestrictedNotice
              title="Akses Strategy Assistant dibatasi"
              message="Role Viewer hanya dapat melihat data. Minta owner/admin menaikkan akses Anda menjadi Editor untuk memakai fitur AI."
            />
          )
        )}

        {currentTab === 'crud_test' && (
          <CrudTestPanel
            currentBrand={activeBrand}
            onRefreshNeeded={() => {
              fetchBrandPosts();
              refreshBrands();
              refreshLicense();
            }}
          />
        )}

        {currentTab === 'team' && (
          <TeamView
            brand={activeBrand}
            currentUserId={user?.id}
            canManage={canManageTeam}
            canManageAdmins={activeRole === 'owner'}
          />
        )}

        {currentTab === 'activity_logs' && (
          <ActivityLogsView
            brand={activeBrand}
          />
        )}

        {currentTab === 'license' && (
          <LicenseQuotaView
            userId={user?.id}
            onRefreshLicense={refreshLicense}
          />
        )}

        {currentTab === 'admin' && (
          <AdminPanelView
            currentUserEmail={user?.email}
          />
        )}

        {/* Placeholder untuk fase berikutnya */}
        {!['dashboard', 'content_db', 'calendar', 'kanban', 'analytics', 'content_posts', 'ai_extractor', 'ai_strategy', 'crud_test', 'team', 'activity_logs', 'license', 'admin'].includes(currentTab) && (
          <NextPhasePlaceholder
            tabId={currentTab}
            onBackToDashboard={() => setCurrentTab('dashboard')}
          />
        )}
      </AppLayout>

      {/* Modal Tambah Brand Baru */}
      <NewBrandModal
        isOpen={isNewBrandOpen}
        onClose={() => setIsNewBrandOpen(false)}
        onSubmit={async (input) => {
          await createBrand(input);
        }}
      />

      {/* Modal Pengaturan & Edit Brand */}
      <BrandSettingsModal
        isOpen={isBrandSettingsOpen}
        brand={activeBrand}
        canEditBrand={canManageTeam}
        canDeleteBrand={activeRole === 'owner'}
        onClose={() => setIsBrandSettingsOpen(false)}
        onUpdated={refreshBrands}
        onDeleted={() => {
          refreshBrands();
          setIsBrandSettingsOpen(false);
        }}
      />

      {/* Modal Buat Konten Baru (Mendukung prefill dari AI Action Plan) */}
      {activeBrand && (
        <NewPostModal
          isOpen={isNewPostOpen}
          brandId={activeBrand.id}
          initialTitle={prefillPost?.title || ''}
          initialPillar={prefillPost?.pillar || 'Edukatif'}
          initialFormat={prefillPost?.format || 'carousel'}
          initialCaption={prefillPost?.caption || ''}
          onClose={() => {
            setIsNewPostOpen(false);
            setPrefillPost(null);
          }}
          onSubmit={handleCreatePost}
        />
      )}

      {/* Modal Penerimaan Undangan Bergabung */}
      {inviteToken && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Undangan Bergabung ke Tim</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Anda menerima tautan undangan untuk bergabung ke brand sebagai anggota tim.
              </p>
            </div>

            {inviteFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  inviteFeedback.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {inviteFeedback.message}
              </div>
            )}

            {!inviteFeedback?.success && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDismissInvite}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Abaikan
                </button>
                <button
                  type="button"
                  onClick={handleAcceptInvite}
                  disabled={acceptingInvite}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {acceptingInvite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Terima Undangan & Bergabung</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function RestrictedNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xs">
      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{message}</p>
    </div>
  );
}

interface PlaceholderInfo {
  title: string;
  phase: string;
  desc: string;
  icon: typeof BarChart3;
}

const placeholderConfigs: Record<string, PlaceholderInfo> = {
  team: {
    title: 'Anggota & Hak Akses Tim',
    phase: 'Fase 5',
    desc: 'Undang rekan tim dan atur izin akses (Owner, Admin, Editor, Viewer) secara terisolasi per brand.',
    icon: Users,
  },
  activity_logs: {
    title: 'Log Aktivitas & Audit Trail',
    phase: 'Fase 5',
    desc: 'Riwayat lengkap setiap tindakan anggota tim: pembuatan konten, perubahan jadwal, dan revisi caption.',
    icon: History,
  },
  license: {
    title: 'Lisensi & Kuota AI',
    phase: 'Fase 5',
    desc: 'Manajemen lisensi sekali bayar (Lifetime Access), pemantauan saldo kredit AI, dan aktivasi paket agensi.',
    icon: Key,
  },
};

function NextPhasePlaceholder({
  tabId,
  onBackToDashboard,
}: {
  tabId: string;
  onBackToDashboard: () => void;
}) {
  const info = placeholderConfigs[tabId] || {
    title: 'Modul Segera Hadir',
    phase: 'Fase Mendatang',
    desc: 'Modul ini disiapkan sesuai rencana rilis bertahap aplikasi.',
    icon: Sparkles,
  };

  const Icon = info.icon;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-8 shadow-xs">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-full mb-4">
        <span>{info.phase}</span>
      </div>
      <div className="w-14 h-14 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{info.title}</h2>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-md mx-auto">
        {info.desc}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          &larr; Kembali ke Dashboard
        </button>
      </div>
    </div>
  );
}
