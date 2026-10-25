/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Sparkles, BarChart3, ScanEye, BrainCircuit, Users, History, Key, ShieldAlert } from 'lucide-react';
import { useAuth } from './hooks/useAuth.ts';
import { useBrands } from './hooks/useBrands.ts';
import { useLicense } from './hooks/useLicense.ts';
import { useAccess } from './hooks/useAccess.ts';
import { SubscriptionGate } from './components/access/SubscriptionGate.tsx';
import { SupportContact } from './components/common/SupportContact.tsx';
import { AuthPage } from './components/auth/AuthPage.tsx';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { DashboardOverview } from './components/dashboard/DashboardOverview.tsx';
import { ContentDatabaseView } from './components/content/ContentDatabaseView.tsx';
import { ContentCalendarView } from './components/content/ContentCalendarView.tsx';
import { ContentKanbanView } from './components/content/ContentKanbanView.tsx';
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

  const {
    status: accessStatus,
    loading: accessLoading,
    error: accessError,
    refresh: refreshAccess,
  } = useAccess(user?.id);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isNewBrandOpen, setIsNewBrandOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isBrandSettingsOpen, setIsBrandSettingsOpen] = useState(false);
  const [entryGateDismissed, setEntryGateDismissed] = useState(() => {
    const id = user?.id;
    if (!id) return false;
    try {
      return sessionStorage.getItem(`zaflow_plan_gate_${id}`) === '1';
    } catch {
      return false;
    }
  });
  const previousUserIdRef = useRef<string | null>(user?.id || null);
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
  const [invitePreviewStatus, setInvitePreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'missing'>(
    () => (inviteToken ? 'loading' : 'idle')
  );
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('confirmed') === '1';
  });
  const confirmationHandledRef = useRef(false);

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
    const previousId = previousUserIdRef.current;

    if (!user?.id) {
      if (previousId) {
        try {
          sessionStorage.removeItem(`zaflow_plan_gate_${previousId}`);
        } catch {
          // Abaikan jika penyimpanan sesi tidak tersedia.
        }
      }
      previousUserIdRef.current = null;
      setEntryGateDismissed(false);
      return;
    }

    if (previousId && previousId !== user.id) {
      try {
        sessionStorage.removeItem(`zaflow_plan_gate_${previousId}`);
      } catch {
        // Abaikan jika penyimpanan sesi tidak tersedia.
      }
    }

    previousUserIdRef.current = user.id;
    try {
      setEntryGateDismissed(sessionStorage.getItem(`zaflow_plan_gate_${user.id}`) === '1');
    } catch {
      setEntryGateDismissed(false);
    }
  }, [user?.id]);

  // Tautan konfirmasi Supabase membuat sesi otomatis. Sesuai permintaan,
  // pengguna diarahkan ke halaman login: sesi ditutup lalu tampilkan pesan sukses.
  useEffect(() => {
    if (!confirmationPending) return;
    if (authLoading) return;
    if (confirmationHandledRef.current) return;
    confirmationHandledRef.current = true;

    const url = new URL(window.location.href);
    url.searchParams.delete('confirmed');
    url.searchParams.delete('type');
    window.history.replaceState({}, '', url.toString());

    signOut()
      .catch(() => {
        // Abaikan: yang penting pengguna kembali ke halaman login.
      })
      .finally(() => {
        setAuthNotice('Email berhasil diverifikasi. Silakan masuk dengan kata sandi Anda.');
        setConfirmationPending(false);
      });
  }, [authLoading, confirmationPending, signOut]);

  // Jika tautan reset tidak menghasilkan sesi recovery, tampilkan pesan yang jelas
  // di halaman login alih-alih membiarkan pengguna di halaman kosong.
  useEffect(() => {
    if (authLoading || passwordRecovery) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') !== '1') return;
    if (user) return;

    params.delete('reset');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    setAuthNotice('Tautan reset kata sandi tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.');
  }, [authLoading, passwordRecovery, user]);

  // Pesan dari tautan email hanya ditampilkan saat pengguna belum masuk.
  useEffect(() => {
    if (user) setAuthNotice(null);
  }, [user]);

  const markEntryGateDismissed = useCallback(() => {
    if (user?.id) {
      try {
        sessionStorage.setItem(`zaflow_plan_gate_${user.id}`, '1');
      } catch {
        // Abaikan jika penyimpanan sesi tidak tersedia.
      }
    }
    setEntryGateDismissed(true);
  }, [user?.id]);

  const handleSignOut = useCallback(async () => {
    if (user?.id) {
      try {
        sessionStorage.removeItem(`zaflow_plan_gate_${user.id}`);
      } catch {
        // Abaikan jika penyimpanan sesi tidak tersedia.
      }
    }
    setEntryGateDismissed(false);
    await signOut();
  }, [user?.id, signOut]);

  // Jika akun kehilangan akses (misalnya dinonaktifkan atau paket berakhir),
  // paksa layar paket/kode tampil lagi saat akses dipulihkan.
  useEffect(() => {
    if (!user?.id) return;
    // Saat status masih dimuat, jangan hapus penanda sesi.
    if (!accessStatus && !accessError) return;
    if (accessStatus?.hasAccess && accessStatus.accountStatus === 'active') return;

    try {
      sessionStorage.removeItem(`zaflow_plan_gate_${user.id}`);
    } catch {
      // Abaikan jika penyimpanan sesi tidak tersedia.
    }
    setEntryGateDismissed(false);
  }, [user?.id, accessStatus, accessError]);

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
    if (!inviteToken) {
      setInvitePreview(null);
      setInvitePreviewStatus('idle');
      return;
    }

    let active = true;
    setInvitePreviewStatus('loading');
    teamService.getInvitationPreview(inviteToken)
      .then((info) => {
        if (!active) return;
        if (info) {
          setInvitePreview(info);
          setInvitePreviewStatus('ready');
        } else {
          setInvitePreview(null);
          setInvitePreviewStatus('missing');
        }
      })
      .catch(() => {
        if (!active) return;
        setInvitePreview(null);
        setInvitePreviewStatus('missing');
      });

    return () => {
      active = false;
    };
  }, [inviteToken]);

  // Setelah kembali dari halaman pembayaran, segarkan akses, kuota, dan brand.
  // Ini juga berlaku untuk perpanjangan ketika pengguna sudah memiliki akses.
  useEffect(() => {
    if (!user?.id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'finish') return;

    let cancelled = false;
    const refreshAll = async () => {
      if (cancelled) return;
      await Promise.allSettled([refreshAccess(), refreshLicense(), refreshBrands()]);
    };

    const first = window.setTimeout(refreshAll, 2500);
    const second = window.setTimeout(async () => {
      await refreshAll();
      if (cancelled) return;
      params.delete('payment');
      params.delete('order_id');
      params.delete('status_code');
      params.delete('transaction_status');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }, 8000);

    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [user?.id, refreshAccess, refreshLicense, refreshBrands]);

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setAcceptingInvite(true);
    try {
      const res = await teamService.acceptInvitation(inviteToken);
      setInviteFeedback({ success: true, message: res.message });
      localStorage.removeItem('zaflow_pending_invite_token');
      await refreshBrands();
      const nextAccess = await refreshAccess();
      await refreshLicense();
      if (nextAccess?.hasAccess) {
        markEntryGateDismissed();
      }
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

  // Menutup sesi otomatis dari tautan konfirmasi email sebelum menampilkan login.
  if (confirmationPending) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-800">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="font-semibold text-sm">Memverifikasi email...</span>
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
    return <AuthPage notice={authNotice} />;
  }

  // Pemeriksaan akses dilakukan setelah login, sebelum workspace ditampilkan.
  // Undangan hanya membuka layar penerimaan, bukan Workspace penuh.
  if (accessLoading || (inviteToken && invitePreviewStatus === 'loading')) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-800">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="font-semibold text-sm">
            {inviteToken && invitePreviewStatus === 'loading' ? 'Memeriksa undangan...' : 'Menyiapkan akun Anda...'}
          </span>
        </div>
      </div>
    );
  }

  if (!accessStatus) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Akun belum dapat dimuat</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {accessError || 'Status akun belum dapat dimuat. Silakan coba lagi.'}
          </p>
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => refreshAccess()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
            >
              <Loader2 className="w-4 h-4" />
              Coba Lagi
            </button>
            <SupportContact label="Hubungi Customer Service" />
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasValidInvite = Boolean(
    inviteToken
    && invitePreview
    && !invitePreview.is_expired
    && accessStatus?.accountStatus === 'active'
  );
  const inviteRoleLabel = invitePreview?.role === 'admin'
    ? 'Admin'
    : invitePreview?.role === 'editor'
      ? 'Editor'
      : invitePreview?.role === 'viewer'
        ? 'Anggota'
        : null;

  if (!accessStatus.hasAccess || !entryGateDismissed) {
    if (!accessStatus.hasAccess && hasValidInvite) {
      return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eff6ff,transparent_38%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-black/[0.06] bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <Users className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-slate-900">Undangan Bergabung ke Tim</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Anda diundang untuk bergabung ke workspace
              {invitePreview?.brand_name ? <> <strong className="text-slate-700">{invitePreview.brand_name}</strong></> : ' ini'}
              {inviteRoleLabel ? ` sebagai ${inviteRoleLabel}` : ''}.
            </p>
            {invitePreview?.email_masked && (
              <p className="mt-1 text-[11px] text-slate-400">Undangan untuk {invitePreview.email_masked}</p>
            )}

            {inviteFeedback && (
              <div
                className={`mt-4 rounded-xl border p-3 text-xs font-medium ${
                  inviteFeedback.success
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {inviteFeedback.message}
              </div>
            )}

            {!inviteFeedback?.success && (
              <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleDismissInvite}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Abaikan
                </button>
                <button
                  type="button"
                  onClick={handleAcceptInvite}
                  disabled={acceptingInvite}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {acceptingInvite && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Terima Undangan
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="mt-5 text-[11px] font-semibold text-slate-400 hover:text-slate-600"
            >
              Keluar dari akun
            </button>
          </div>
        </div>
      );
    }

    return (
      <SubscriptionGate
        status={accessStatus}
        onContinue={accessStatus.hasAccess ? markEntryGateDismissed : undefined}
        onRefresh={async () => {
          const next = await refreshAccess();
          if (next?.hasAccess) {
            await Promise.allSettled([refreshLicense(), refreshBrands()]);
          }
          return next;
        }}
        onSignOut={handleSignOut}
      />
    );
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
        onSignOut={handleSignOut}
        customerService={accessStatus ? {
          whatsappUrl: accessStatus.customerService.whatsappUrl,
          label: accessStatus.customerService.label,
        } : null}
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
              message="Akun Anda hanya dapat melihat data. Minta pemilik atau admin menaikkan akses menjadi Editor untuk memakai fitur AI."
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
              message="Akun Anda hanya dapat melihat data. Minta pemilik atau admin menaikkan akses menjadi Editor untuk memakai fitur AI."
            />
          )
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
        {!['dashboard', 'content_db', 'calendar', 'kanban', 'analytics', 'content_posts', 'ai_extractor', 'ai_strategy', 'team', 'activity_logs', 'license', 'admin'].includes(currentTab) && (
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
          brand={activeBrand}
          initialTitle={prefillPost?.title || ''}
          initialPillar={prefillPost?.pillar || ''}
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
      {inviteToken && invitePreview && !invitePreview.is_expired && (
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
    title: 'Paket & Kuota AI',
    phase: 'Fase 5',
    desc: 'Kelola paket bulanan, masa aktif, kode aktivasi, dan saldo kredit AI Anda.',
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
