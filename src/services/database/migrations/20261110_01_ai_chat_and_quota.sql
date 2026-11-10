-- ==============================================================================
-- CHAT AI & KONSULTASI (per brand, per pengguna)
-- - Menyimpan percakapan dan pesan chat konsultasi.
-- - Menambahkan action_type 'ai_chat' pada log kuota dan RPC pemotongan kredit.
-- ==============================================================================

-- 1. Tabel percakapan
CREATE TABLE IF NOT EXISTS public.ai_chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Konsultasi Baru',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_owner
    ON public.ai_chat_conversations(brand_id, user_id, updated_at DESC);

-- 2. Tabel pesan
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    mode TEXT CHECK (mode IN ('data', 'consultation')),
    content TEXT NOT NULL,
    tokens_consumed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation
    ON public.ai_chat_messages(conversation_id, created_at ASC);

-- 3. RLS: pengguna hanya dapat mengakses percakapan miliknya sendiri.
ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pengguna dapat melihat percakapan AI miliknya" ON public.ai_chat_conversations;
CREATE POLICY "Pengguna dapat melihat percakapan AI miliknya"
    ON public.ai_chat_conversations FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat membuat percakapan AI miliknya" ON public.ai_chat_conversations;
CREATE POLICY "Pengguna dapat membuat percakapan AI miliknya"
    ON public.ai_chat_conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat memperbarui percakapan AI miliknya" ON public.ai_chat_conversations;
CREATE POLICY "Pengguna dapat memperbarui percakapan AI miliknya"
    ON public.ai_chat_conversations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat menghapus percakapan AI miliknya" ON public.ai_chat_conversations;
CREATE POLICY "Pengguna dapat menghapus percakapan AI miliknya"
    ON public.ai_chat_conversations FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat melihat pesan pada percakapannya" ON public.ai_chat_messages;
CREATE POLICY "Pengguna dapat melihat pesan pada percakapannya"
    ON public.ai_chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_chat_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Pengguna dapat menulis pesan pada percakapannya" ON public.ai_chat_messages;
CREATE POLICY "Pengguna dapat menulis pesan pada percakapannya"
    ON public.ai_chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_chat_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Pengguna dapat menghapus pesan pada percakapannya" ON public.ai_chat_messages;
CREATE POLICY "Pengguna dapat menghapus pesan pada percakapannya"
    ON public.ai_chat_messages FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_chat_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );

-- 4. Izinkan action_type 'ai_chat' pada log penggunaan AI.
ALTER TABLE public.ai_usage_logs
    DROP CONSTRAINT IF EXISTS ai_usage_logs_action_type_check;
ALTER TABLE public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_action_type_check
    CHECK (action_type IN ('metrics_extractor', 'strategy_assistant', 'caption_writer', 'ai_chat'));

-- 5. Perbarui RPC pemotongan kuota agar menerima 'ai_chat'.
CREATE OR REPLACE FUNCTION public.consume_ai_credit(
    p_user_id UUID,
    p_brand_id UUID,
    p_action_type TEXT,
    p_summary TEXT
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INT,
    total INT,
    used INT,
    license_id UUID,
    log_id UUID,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_license public.licenses;
    v_updated public.licenses;
    v_log_id UUID;
BEGIN
    IF p_action_type NOT IN ('metrics_extractor', 'strategy_assistant', 'caption_writer', 'ai_chat') THEN
        RAISE EXCEPTION 'action_type tidak valid';
    END IF;

    SELECT * INTO v_license
    FROM public.get_active_license(p_user_id);

    IF v_license.id IS NULL THEN
        SELECT * INTO v_license
        FROM public.licenses
        WHERE owner_user_id = p_user_id
          AND status IN ('expired', 'past_due', 'trialing', 'active', 'canceled')
        ORDER BY COALESCE(current_period_end, updated_at) DESC
        LIMIT 1;

        IF v_license.id IS NOT NULL THEN
            RETURN QUERY SELECT
                false,
                GREATEST(v_license.ai_quota_total - v_license.ai_quota_used, 0),
                v_license.ai_quota_total,
                v_license.ai_quota_used,
                v_license.id,
                NULL::uuid,
                'Masa aktif akun telah berakhir. Silakan perpanjang paket untuk melanjutkan.';
            RETURN;
        END IF;

        RETURN QUERY SELECT false, 0, 0, 0, NULL::uuid, NULL::uuid, 'Akun belum memiliki akses aktif.';
        RETURN;
    END IF;

    UPDATE public.licenses
    SET ai_quota_used = ai_quota_used + 1,
        updated_at = NOW()
    WHERE id = v_license.id
      AND status IN ('active', 'trialing', 'past_due')
      AND (
          is_legacy_lifetime = TRUE
          OR (
              current_period_end IS NOT NULL
              AND current_period_end > (
                  NOW() - CASE
                      WHEN status IN ('active', 'past_due') THEN INTERVAL '3 days'
                      ELSE INTERVAL '0'
                  END
              )
          )
      )
      AND ai_quota_used < ai_quota_total
    RETURNING * INTO v_updated;

    IF v_updated.id IS NULL THEN
        SELECT * INTO v_updated FROM public.licenses WHERE id = v_license.id;
        RETURN QUERY SELECT
            false,
            GREATEST(v_updated.ai_quota_total - v_updated.ai_quota_used, 0),
            v_updated.ai_quota_total,
            v_updated.ai_quota_used,
            v_updated.id,
            NULL::uuid,
            'Kuota kredit AI Anda telah habis. Silakan perpanjang atau tingkatkan paket.';
        RETURN;
    END IF;

    INSERT INTO public.ai_usage_logs (
        user_id, brand_id, license_id, action_type, tokens_consumed, credits_deducted, prompt_summary
    )
    VALUES (
        p_user_id, p_brand_id, v_updated.id, p_action_type, 0, 1, left(coalesce(p_summary, ''), 300)
    )
    RETURNING id INTO v_log_id;

    RETURN QUERY SELECT
        true,
        v_updated.ai_quota_total - v_updated.ai_quota_used,
        v_updated.ai_quota_total,
        v_updated.ai_quota_used,
        v_updated.id,
        v_log_id,
        NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_credit(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(UUID, UUID, TEXT, TEXT) TO service_role;
