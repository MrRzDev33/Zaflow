import { supabase, isConfigured } from '../../config/supabase.ts';
import { ContentPost, ContentStatus, ContentFormat } from '../../types/database.ts';
import { activityService } from './activityService.ts';

export interface CreatePostInput {
  brand_id: string;
  title: string;
  caption?: string | null;
  brief?: string | null;
  hashtags?: string[];
  channels?: string[];
  format?: ContentFormat;
  pillar?: string;
  status?: ContentStatus;
  scheduled_at?: string | null;
  posted_at?: string | null;
  production_date?: string | null;
  post_url?: string | null;
  media_urls?: string[];
}

export interface UpdatePostInput {
  title?: string;
  caption?: string | null;
  brief?: string | null;
  hashtags?: string[];
  channels?: string[];
  format?: ContentFormat;
  pillar?: string;
  status?: ContentStatus;
  scheduled_at?: string | null;
  posted_at?: string | null;
  production_date?: string | null;
  post_url?: string | null;
  media_urls?: string[];
}

/**
 * Status dianggap sudah tayang jika memakai ID default `published`
 * atau status kustom yang mengandung kata publish/post/posted/tayang.
 */
export function isPublishedStatus(status?: string | null): boolean {
  if (!status) return false;
  return /publish|posted|posting|tayang/i.test(status);
}

function normalizePostUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export interface PostFilterOptions {
  search?: string;
  channel?: string;
  pillar?: string;
  status?: ContentStatus | 'all';
  format?: ContentFormat | 'all';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface DashboardStats {
  totalContent: number;
  scheduledCount: number;
  reviewCount: number;
  publishedCount: number;
  pillarDistribution: { pillar: string; count: number }[];
  recentPosts: ContentPost[];
}

export const contentService = {
  /**
   * Mengambil daftar postingan untuk brand tertentu dengan filter lengkap
   */
  async getPosts(brandId: string, options?: PostFilterOptions): Promise<ContentPost[]> {
    if (!isConfigured || !brandId) return [];

    let query = supabase
      .from('content_posts')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.format && options.format !== 'all') {
      query = query.eq('format', options.format);
    }

    if (options?.pillar && options.pillar !== 'all') {
      query = query.eq('pillar', options.pillar);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Gagal mengambil konten postingan:', error);
      throw error;
    }

    let posts = (data || []) as ContentPost[];

    // Filter channel jika dipilih
    if (options?.channel && options.channel !== 'all') {
      posts = posts.filter((p) => p.channels?.includes(options.channel!));
    }

    // Filter teks pencarian (judul, caption, brief, hashtag)
    if (options?.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim();
      posts = posts.filter((p) => {
        const titleMatch = p.title?.toLowerCase().includes(q);
        const captionMatch = p.caption?.toLowerCase().includes(q);
        const briefMatch = p.brief?.toLowerCase().includes(q);
        const tagMatch = p.hashtags?.some((t) => t.toLowerCase().includes(q));
        const pillarMatch = p.pillar?.toLowerCase().includes(q);
        return titleMatch || captionMatch || briefMatch || tagMatch || pillarMatch;
      });
    }

    // Filter rentang tanggal berdasarkan tanggal posting aktual,
    // lalu fallback ke jadwal tayang untuk data lama.
    const effectiveDate = (p: ContentPost) => p.posted_at || p.scheduled_at || p.updated_at || p.created_at;
    if (options?.startDate) {
      const start = new Date(options.startDate).getTime();
      posts = posts.filter((p) => {
        const value = effectiveDate(p);
        return value ? new Date(value).getTime() >= start : false;
      });
    }
    if (options?.endDate) {
      const end = new Date(options.endDate).getTime();
      posts = posts.filter((p) => {
        const value = effectiveDate(p);
        return value ? new Date(value).getTime() <= end : false;
      });
    }

    return posts;
  },

  /**
   * Mengambil konten yang sudah tayang/dipublikasikan. Dipakai oleh halaman
   * histori performa "Konten Post" di Analitik & Strategi.
   */
  async getPublishedPosts(brandId: string, options?: Omit<PostFilterOptions, 'status'>): Promise<ContentPost[]> {
    const allPosts = await this.getPosts(brandId, { ...options, status: 'all' });
    return allPosts.filter((post) => isPublishedStatus(post.status));
  },

  /**
   * Mengambil satu postingan berdasarkan ID
   */
  async getPostById(postId: string): Promise<ContentPost | null> {
    if (!isConfigured || !postId) return null;

    const { data, error } = await supabase
      .from('content_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();

    if (error) {
      console.error('Gagal mengambil postingan:', error);
      throw error;
    }

    return data as ContentPost | null;
  },

  /**
   * Membuat postingan baru di Supabase
   */
  async createPost(input: CreatePostInput): Promise<ContentPost> {
    if (!isConfigured) {
      throw new Error('Supabase belum terkonfigurasi.');
    }

    const title = input.title.trim();
    if (!title) {
      throw new Error('Judul postingan tidak boleh kosong.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    const status = input.status || 'idea';
    const postedAt = input.posted_at || (isPublishedStatus(status) ? new Date().toISOString() : null);

    const { data, error } = await supabase
      .from('content_posts')
      .insert({
        brand_id: input.brand_id,
        title,
        caption: input.caption?.trim() || null,
        brief: input.brief?.trim() || null,
        hashtags: input.hashtags || [],
        channels: input.channels && input.channels.length > 0 ? input.channels : ['instagram'],
        format: input.format || 'single_image',
        pillar: input.pillar || 'Edukatif',
        status,
        scheduled_at: input.scheduled_at || null,
        posted_at: postedAt,
        production_date: input.production_date || null,
        post_url: normalizePostUrl(input.post_url),
        media_urls: input.media_urls || [],
        author_id: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Gagal membuat konten:', error);
      throw error;
    }
    const createdPost = data as ContentPost;
    await activityService.logActivity(createdPost.brand_id, 'Membuat Konten', 'content_post', createdPost.id, { title: createdPost.title, status: createdPost.status });
    return createdPost;
  },

  /**
   * Memperbarui postingan di Supabase
   */
  async updatePost(postId: string, input: UpdatePostInput): Promise<ContentPost> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) {
      const t = input.title.trim();
      if (!t) throw new Error('Judul konten tidak boleh kosong.');
      payload.title = t;
    }
    if (input.caption !== undefined) payload.caption = input.caption?.trim() || null;
    if (input.brief !== undefined) payload.brief = input.brief?.trim() || null;
    if (input.hashtags !== undefined) payload.hashtags = input.hashtags;
    if (input.channels !== undefined) payload.channels = input.channels;
    if (input.format !== undefined) payload.format = input.format;
    if (input.pillar !== undefined) payload.pillar = input.pillar;
    if (input.status !== undefined) payload.status = input.status;
    if (input.scheduled_at !== undefined) payload.scheduled_at = input.scheduled_at;
    if (input.posted_at !== undefined) payload.posted_at = input.posted_at;
    if (input.production_date !== undefined) payload.production_date = input.production_date;
    if (input.post_url !== undefined) payload.post_url = normalizePostUrl(input.post_url);
    if (input.media_urls !== undefined) payload.media_urls = input.media_urls;

    // Saat status diubah menjadi published dan belum punya tanggal posting aktual,
    // isi otomatis dengan waktu sekarang agar halaman histori dapat memfilternya.
    if (
      input.status !== undefined &&
      isPublishedStatus(input.status) &&
      input.posted_at === undefined
    ) {
      const { data: currentPost } = await supabase
        .from('content_posts')
        .select('posted_at')
        .eq('id', postId)
        .maybeSingle();
      if (!currentPost?.posted_at) {
        payload.posted_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('content_posts')
      .update(payload)
      .eq('id', postId)
      .select()
      .single();

    if (error) {
      console.error('Gagal memperbarui postingan:', error);
      throw error;
    }

    const updatedPost = data as ContentPost;
    await activityService.logActivity(updatedPost.brand_id, 'Memperbarui Konten', 'content_post', updatedPost.id, { title: updatedPost.title, status: updatedPost.status });

    return updatedPost;
  },

  /**
   * Mengubah status alur kerja postingan (drag-and-drop Kanban)
   */
  async updatePostStatus(postId: string, status: ContentStatus): Promise<ContentPost> {
    return this.updatePost(postId, { status });
  },

  /**
   * Mengubah jadwal postingan (drag-and-drop Kalender)
   */
  async updatePostSchedule(postId: string, scheduledAt: string | null): Promise<ContentPost> {
    return this.updatePost(postId, { scheduled_at: scheduledAt });
  },

  /**
   * Menduplikasi postingan sebagai salinan baru (cloning)
   */
  async duplicatePost(postId: string): Promise<ContentPost> {
    const original = await this.getPostById(postId);
    if (!original) throw new Error('Postingan sumber tidak ditemukan.');

    const duplicatedInput: CreatePostInput = {
      brand_id: original.brand_id,
      title: `${original.title} (Salinan)`,
      caption: original.caption,
      brief: original.brief || null,
      hashtags: [...(original.hashtags || [])],
      channels: [...(original.channels || ['instagram'])],
      format: original.format,
      pillar: original.pillar,
      status: 'draft', // Selalu mulai dari draft saat menduplikasi
      scheduled_at: null, // Reset jadwal tayang agar diatur ulang
      posted_at: null,
      production_date: original.production_date || null,
      post_url: null,
      media_urls: [...(original.media_urls || [])],
    };

    return this.createPost(duplicatedInput);
  },

  /**
   * Menghapus postingan di Supabase
   */
  async deletePost(postId: string): Promise<void> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const post = await this.getPostById(postId);
    const { error } = await supabase
      .from('content_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      console.error('Gagal menghapus postingan:', error);
      throw error;
    }

    if (post) {
      await activityService.logActivity(post.brand_id, 'Menghapus Konten', 'content_post', postId, { title: post.title });
    }
  },

  /**
   * Mengambil statistik ringkas untuk dashboard
   */
  async getDashboardStats(brandId: string): Promise<DashboardStats> {
    if (!isConfigured || !brandId) {
      return {
        totalContent: 0,
        scheduledCount: 0,
        reviewCount: 0,
        publishedCount: 0,
        pillarDistribution: [],
        recentPosts: [],
      };
    }

    const { data: posts, error } = await supabase
      .from('content_posts')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Gagal mengambil statistik dashboard:', error);
      throw error;
    }

    const allPosts = (posts || []) as ContentPost[];

    const scheduledCount = allPosts.filter((p) => p.status === 'scheduled').length;
    const reviewCount = allPosts.filter((p) => p.status === 'in_review').length;
    const publishedCount = allPosts.filter((p) => p.status === 'published').length;

    const pillarMap = new Map<string, number>();
    for (const post of allPosts) {
      const p = post.pillar || 'Lainnya';
      pillarMap.set(p, (pillarMap.get(p) || 0) + 1);
    }

    const pillarDistribution = Array.from(pillarMap.entries()).map(([pillar, count]) => ({
      pillar,
      count,
    }));

    return {
      totalContent: allPosts.length,
      scheduledCount,
      reviewCount,
      publishedCount,
      pillarDistribution,
      recentPosts: allPosts.slice(0, 6),
    };
  },
};
