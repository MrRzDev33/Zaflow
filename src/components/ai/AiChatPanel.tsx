import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  History,
  Loader2,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from '../common/icons/lucide-compat.tsx';
import { AiChatConversation, AiChatMessage, AiChatMode, Brand } from '../../types/database.ts';
import { aiClientService } from '../../services/ai/aiClientService.ts';
import { workflowSettingsService } from '../../services/database/workflowSettingsService.ts';

interface AiChatPanelProps {
  brand: Brand | null;
  aiCreditsRemaining: number;
  onRefreshLicense: () => void;
}

const MODE_OPTIONS: Array<{ value: AiChatMode; label: string; hint: string }> = [
  {
    value: 'data',
    label: 'Data Brand',
    hint: 'Jawaban wajib berdasarkan angka dan fakta dari data brand Anda.',
  },
  {
    value: 'consultation',
    label: 'Konsultasi',
    hint: 'Saran umum dan ide kreatif; saran non-data akan diberi label jelas.',
  },
];

const DATA_SUGGESTIONS = [
  'Konten mana yang paling efektif dan mengapa?',
  'Platform mana yang performanya paling baik?',
  'Pilar konten apa yang punya engagement tertinggi?',
  'Apa rekomendasi dari tren 30 hari terakhir?',
];

const CONSULTATION_SUGGESTIONS = [
  'Buat ide konten untuk 1 minggu ke depan.',
  'Bagaimana cara menaikkan jumlah saves?',
  'Susun 5 hook untuk Reels yang mendorong saves.',
  'Buat kerangka carousel tentang tips praktis.',
];

function formatChatTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatConversationDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date);
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  brand,
  aiCreditsRemaining,
  onRefreshLicense,
}) => {
  const [mode, setMode] = useState<AiChatMode>('data');
  const [conversations, setConversations] = useState<AiChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const suggestions = mode === 'data' ? DATA_SUGGESTIONS : CONSULTATION_SUGGESTIONS;
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, scrollToBottom]);

  const loadConversations = useCallback(async () => {
    if (!brand) return;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const rows = await aiClientService.listChatConversations(brand.id);
      setConversations(rows);
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : 'Gagal memuat riwayat chat.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [brand]);

  useEffect(() => {
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    setInput('');
    setError(null);
    setHistoryError(null);
    void loadConversations();
  }, [brand?.id, loadConversations]);

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput('');
    setError(null);
    textareaRef.current?.focus();
  };

  const openConversation = async (conversationId: string) => {
    if (isSending || conversationId === activeConversationId) return;
    setActiveConversationId(conversationId);
    setMessages([]);
    setError(null);
    setIsLoadingConversation(true);
    try {
      const detail = await aiClientService.getChatConversation(conversationId);
      setMessages(detail.messages);
      const lastUser = [...detail.messages].reverse().find((item) => item.role === 'user');
      if (lastUser?.mode === 'consultation' || lastUser?.mode === 'data') {
        setMode(lastUser.mode);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat percakapan.');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!window.confirm('Hapus percakapan ini beserta seluruh pesannya?')) return;
    try {
      await aiClientService.deleteChatConversation(conversationId);
      setConversations((prev) => prev.filter((item) => item.id !== conversationId));
      if (activeConversationId === conversationId) {
        startNewChat();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus percakapan.');
    }
  };

  const sendMessage = async (textOverride?: string) => {
    if (!brand || isSending) return;
    const text = (textOverride ?? input).trim();
    if (!text) return;

    if (aiCreditsRemaining <= 0) {
      setError('Kuota kredit AI Anda telah habis. Silakan periksa halaman Paket & Kuota.');
      return;
    }

    const optimistic: AiChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId || '',
      role: 'user',
      mode,
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setError(null);
    setIsSending(true);

    try {
      const response = await aiClientService.sendChatMessage({
        brandId: brand.id,
        conversationId: activeConversationId,
        message: text,
        mode,
        pillars: brand ? workflowSettingsService.getConfiguredPillars(brand) : [],
      });

      setActiveConversationId(response.conversationId);
      setMessages((prev) => [
        ...prev.filter((item) => item.id !== optimistic.id),
        ...(response.messages || []),
      ]);

      // Perbarui riwayat agar judul dan urutan percakapan ikut terbarui.
      const rows = await aiClientService.listChatConversations(brand.id);
      setConversations(rows);
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((item) => item.id !== optimistic.id));
      setInput(text);
      setError(err instanceof Error ? err.message : 'Gagal mengirim pesan chat.');
    } finally {
      setIsSending(false);
      onRefreshLicense();
      textareaRef.current?.focus();
    }
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  if (!brand) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto">
        <MessageCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800">Pilih atau buat brand terlebih dahulu</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Riwayat percakapan */}
      <aside className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Riwayat Chat</h2>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100"
            title="Mulai percakapan baru"
          >
            <Plus className="w-3 h-3" />
            Baru
          </button>
        </div>

        <div className="max-h-[360px] lg:max-h-[560px] overflow-y-auto p-2 space-y-1">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Memuat riwayat...
            </div>
          ) : historyError ? (
            <p className="px-2 py-6 text-center text-[11px] text-red-600">{historyError}</p>
          ) : conversations.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <MessageCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
              <p className="text-[11px] text-slate-400">Belum ada riwayat. Mulai konsultasi pertama Anda.</p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === activeConversationId;
              return (
                <div
                  key={conversation.id}
                  className={`group flex items-start gap-1 rounded-xl border px-2.5 py-2 transition ${
                    active
                      ? 'border-blue-200 bg-blue-50/70'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation.id)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-[11px] font-semibold ${
                          active ? 'text-blue-800' : 'text-slate-700'
                        }`}
                      >
                        {conversation.title || 'Konsultasi Baru'}
                      </p>
                      <span className="shrink-0 text-[9px] text-slate-400">
                        {formatConversationDate(conversation.updated_at)}
                      </span>
                    </div>
                    {conversation.last_message && (
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                        {conversation.last_message}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteConversation(conversation.id)}
                    className="mt-0.5 shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="Hapus percakapan"
                    aria-label="Hapus percakapan"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Area chat */}
      <section className="lg:col-span-9 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col min-h-[560px]">
        <div className="border-b border-slate-100 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {activeConversation?.title || 'Konsultasi Baru'}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {aiCreditsRemaining} kredit tersedia • 1 kredit per pesan
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs self-start">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`rounded-md px-2.5 py-1 font-semibold transition cursor-pointer ${
                    mode === option.value
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-500">
            {mode === 'data' ? (
              <ShieldCheck className="mt-0.5 w-3 h-3 shrink-0 text-emerald-600" />
            ) : (
              <Sparkles className="mt-0.5 w-3 h-3 shrink-0 text-amber-500" />
            )}
            <span>{MODE_OPTIONS.find((option) => option.value === mode)?.hint}</span>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-h-[520px]">
          {isLoadingConversation ? (
            <div className="flex h-full min-h-[260px] items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat percakapan...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Mulai konsultasi dengan Zaflow AI</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Tanyakan performa konten, minta ide kreatif, atau diskusikan strategi. Pilih mode di atas
                sesuai kebutuhan.
              </p>

              <div className="mt-4 grid w-full max-w-2xl grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-left text-[11px] text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-slate-100 text-slate-800 rounded-bl-md'
                      }`}
                    >
                      {message.content}
                    </div>
                    <p className="mt-1 text-[9px] text-slate-400 px-1">
                      {formatChatTime(message.created_at)}
                      {!isUser && message.mode === 'consultation' ? ' • saran konsultasi' : ''}
                    </p>
                  </div>
                  {isUser && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <UserRound className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Zaflow AI sedang menyusun jawaban...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-100 p-3">
          {aiCreditsRemaining <= 0 && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-800">
              <AlertCircle className="w-3 h-3 shrink-0" />
              Kuota kredit AI habis. Tingkatkan paket untuk melanjutkan chat.
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, 4000))}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                mode === 'data'
                  ? 'Tanyakan angka performa brand Anda... (Enter untuk kirim)'
                  : 'Tulis pertanyaan atau minta ide konten... (Enter untuk kirim)'
              }
              disabled={isSending || isLoadingConversation}
              className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!input.trim() || isSending || isLoadingConversation || aiCreditsRemaining <= 0}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Kirim pesan (1 kredit)"
              aria-label="Kirim pesan"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between px-1 text-[9px] text-slate-400">
            <span>Shift + Enter untuk baris baru • 1 pesan = 1 kredit AI</span>
            <span>{input.length}/4000</span>
          </div>
        </div>
      </section>
    </div>
  );
};
