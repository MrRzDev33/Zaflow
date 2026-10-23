import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, Mail, Trash2, CheckCircle, AlertCircle, RefreshCw, Copy, Check, Clock, Link as LinkIcon } from 'lucide-react';
import { Brand, BrandMember } from '../../types/database.ts';
import { teamService, BrandInvitation } from '../../services/database/teamService.ts';

interface TeamViewProps {
  brand: Brand | null;
  currentUserId?: string;
  canManage?: boolean;
  canManageAdmins?: boolean;
}

const roleLabels: Record<string, string> = {
  owner: 'Pemilik',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Anggota',
};

export const TeamView: React.FC<TeamViewProps> = ({
  brand,
  currentUserId,
  canManage = true,
  canManageAdmins = true,
}) => {
  const [members, setMembers] = useState<BrandMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<BrandInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!brand) {
      setMembers([]);
      setPendingInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        teamService.getBrandMembers(brand.id),
        teamService.getPendingInvitations(brand.id),
      ]);
      setMembers(membersData);
      setPendingInvites(invitesData.filter((i) => i.status === 'pending'));
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat daftar anggota.');
    } finally {
      setLoading(false);
    }
  }, [brand]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const myRole = members.find((m) => m.user_id === currentUserId)?.role || null;
  const isOwner = myRole === 'owner';
  const effectiveCanManage = canManage && (isOwner || myRole === 'admin');
  const effectiveCanManageAdmins = canManageAdmins && (isOwner || myRole === 'admin');

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !inviteEmail.trim()) return;
    if (!effectiveCanManage) {
      setErrorMsg('Anda tidak memiliki izin mengundang anggota.');
      return;
    }
    setInviting(true);
    setErrorMsg(null);
    try {
      const res = await teamService.inviteMember(brand.id, inviteEmail.trim(), inviteRole);
      setSuccessMsg(`Undangan berhasil dibuat untuk ${inviteEmail}`);
      if (res.inviteUrl) {
        setCreatedInviteUrl(res.inviteUrl);
      } else {
        setIsInviteOpen(false);
        setInviteEmail('');
      }
      loadMembers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat undangan.');
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!brand || !effectiveCanManage) return;
    if (!window.confirm('Batalkan undangan ini? Tautan undangan tidak akan dapat digunakan lagi.')) return;
    try {
      await teamService.cancelInvitation(brand.id, inviteId);
      setSuccessMsg('Undangan berhasil dibatalkan.');
      loadMembers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membatalkan undangan.');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'owner' | 'admin' | 'editor' | 'viewer') => {
    if (!brand || !effectiveCanManage) return;
    if (!window.confirm(`Ubah role anggota ini menjadi ${newRole}?`)) return;
    try {
      await teamService.updateMemberRole(brand.id, userId, newRole);
      setSuccessMsg('Role anggota berhasil diperbarui.');
      loadMembers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah role.');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!brand) return;
    if (!effectiveCanManage && userId !== currentUserId) return;
    if (!window.confirm('Apakah Anda yakin ingin mencabut akses anggota ini dari brand?')) return;
    try {
      await teamService.removeMember(brand.id, userId);
      setSuccessMsg('Akses anggota berhasil dicabut.');
      loadMembers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus anggota.');
    }
  };

  if (!brand) {
    return (
      <div className="p-8 text-center text-slate-500">
        <Users className="w-12 h-12 mx-auto text-slate-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Pilih Brand Terlebih Dahulu</h2>
        <p className="text-sm text-slate-500 mt-1">Manajemen anggota dan tim dikelola secara terisolasi per brand.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.color_hex }} />
            <h1 className="text-xl font-extrabold text-slate-900">Anggota & Tim: {brand.name}</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola hak akses rekan tim (Pemilik, Admin, Editor, Anggota) dengan data yang terpisah aman.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadMembers}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors"
            title="Muat Ulang"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {effectiveCanManage && (
            <button
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Undang Anggota</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Daftar Anggota Brand ({members.length})</h3>
          <span className="text-xs text-slate-500">Workspace Terisolasi</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Memuat daftar anggota...</div>
        ​) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">Belum ada anggota terdaftar di brand ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-3">Nama Anggota</th>
                  <th className="px-6 py-3">Role Hak Akses</th>
                  <th className="px-6 py-3">Tanggal Bergabung</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {members.map((m) => {
                  const profile = m.profile;
                  const isSelf = m.user_id === currentUserId;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                            {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {profile?.full_name || 'Pengguna'} {isSelf && '(Anda)'}
                            </span>
                            <span className="text-slate-400 text-[11px]">Anggota workspace</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${
                            m.role === 'owner'
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : m.role === 'admin'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : m.role === 'editor'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{roleLabels[m.role] || 'Anggota'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(m.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {effectiveCanManage && m.role !== 'owner' && (effectiveCanManageAdmins || !['admin', 'owner'].includes(m.role)) && (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.user_id, e.target.value as any)}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            {effectiveCanManageAdmins && <option value="admin">Admin</option>}
                            <option value="editor">Editor</option>
                            <option value="viewer">Anggota</option>
                          </select>
                        )}
                        {m.role !== 'owner' && (effectiveCanManage || isSelf) && (
                          <button
                            onClick={() => handleRemoveMember(m.user_id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                            title={isSelf ? 'Keluar dari brand' : 'Cabut Akses'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations Section */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Undangan Menunggu Konfirmasi ({pendingInvites.length})</h3>
                <p className="text-xs text-slate-500">Tautan undangan aktif yang dapat disalin dan dibagikan ke calon anggota</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-3">Email Undangan</th>
                  <th className="px-6 py-3">Role Ditawarkan</th>
                  <th className="px-6 py-3">Kedaluwarsa</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingInvites.map((invite) => {
                  const inviteUrl = `${window.location.origin}/?invite_token=${invite.token}`;
                  return (
                    <tr key={invite.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-slate-800 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{invite.email}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase bg-slate-100 text-slate-700">
                          {roleLabels[invite.role] || 'Anggota'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 text-[11px]">
                        {new Date(invite.expires_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        {effectiveCanManage ? (
                          <>
                            <button
                              onClick={() => copyToClipboard(inviteUrl)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              title="Salin Tautan Undangan"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Salin Link</span>
                            </button>
                            <button
                              onClick={() => handleCancelInvite(invite.id)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Batalkan Undangan"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Batal</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400">Hanya pemilik/admin</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <span>Undang Anggota ke {brand.name}</span>
              </h3>
              <button
                onClick={() => {
                  setIsInviteOpen(false);
                  setCreatedInviteUrl(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="space-y-4 py-2">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold block">Undangan Berhasil Dibuat!</span>
                    <span className="text-[11px] text-emerald-700 mt-0.5 block leading-relaxed">
                      Salin tautan undangan di bawah ini dan kirimkan ke rekan Anda melalui WhatsApp, Telegram, atau Email:
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tautan Bergabung ke Brand</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdInviteUrl}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdInviteUrl)}
                      className={`px-3.5 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                        copied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      }`}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Tersalin!' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedInviteUrl(null);
                      setIsInviteOpen(false);
                      setInviteEmail('');
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Rekan Tim</label>
                  <input
                    type="email"
                    required
                    placeholder="rekan@perusahaan.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Peran Anggota</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-blue-600"
                  >
                    {effectiveCanManageAdmins && (
                      <option value="admin">Admin (Operasional & Anggota)</option>
                    )}
                    <option value="editor">Editor (Membuat & Mengedit Konten)</option>
                    <option value="viewer">Anggota (Hanya Melihat Data)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {inviting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Buat Tautan Undangan</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
