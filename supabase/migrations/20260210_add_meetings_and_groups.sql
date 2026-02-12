-- Created: 2026-02-10 00:00:00
-- 회의 안건방 및 동적 그룹/개별 대상 지정 기능 마이그레이션

-- ============================================
-- 1. USERS 테이블 - nickname 필드 추가
-- ============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nickname TEXT;

-- ============================================
-- 2. GROUPS 테이블 (동적 그룹 관리)
-- ============================================
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. USER_GROUPS 테이블 (사용자-그룹 연결)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    UNIQUE(user_id, group_id)
);

-- user_groups 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON public.user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON public.user_groups(group_id);

-- ============================================
-- 4. POST_TARGET_USERS 테이블 (개별 대상 지정)
-- ============================================
CREATE TABLE IF NOT EXISTS public.post_target_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.educational_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    UNIQUE(post_id, user_id)
);

-- post_target_users 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_post_target_users_post_id ON public.post_target_users(post_id);
CREATE INDEX IF NOT EXISTS idx_post_target_users_user_id ON public.post_target_users(user_id);

-- ============================================
-- 5. EDUCATIONAL_POSTS 테이블 - targeting_type 필드 추가
-- ============================================
ALTER TABLE public.educational_posts
ADD COLUMN IF NOT EXISTS targeting_type TEXT NOT NULL DEFAULT 'group'
CHECK (targeting_type IN ('group', 'individual'));

-- ============================================
-- 6. POST_GROUPS 테이블 - 하드코딩된 CHECK 제약조건 제거
-- ============================================
-- 기존 group_name CHECK 제약조건 삭제 (이제 groups 테이블에서 동적으로 관리)
ALTER TABLE public.post_groups DROP CONSTRAINT IF EXISTS post_groups_group_name_check;

-- ============================================
-- 7. MEETING_POSTS 테이블 (회의 안건방)
-- ============================================
CREATE TABLE IF NOT EXISTS public.meeting_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    post_type TEXT NOT NULL DEFAULT 'free' CHECK (post_type IN ('free', 'poll')),
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    allow_multiple BOOLEAN NOT NULL DEFAULT false,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- meeting_posts 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_meeting_posts_author_id ON public.meeting_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_meeting_posts_created_at ON public.meeting_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_posts_post_type ON public.meeting_posts(post_type);

-- updated_at 자동 업데이트 트리거 (기존 update_updated_at_column 함수 재사용)
CREATE TRIGGER update_meeting_posts_updated_at
    BEFORE UPDATE ON public.meeting_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. MEETING_COMMENTS 테이블 (회의 댓글)
-- ============================================
CREATE TABLE IF NOT EXISTS public.meeting_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.meeting_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- meeting_comments 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_meeting_comments_post_id ON public.meeting_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_meeting_comments_author_id ON public.meeting_comments(author_id);

-- ============================================
-- 9. MEETING_POLL_OPTIONS 테이블 (투표 선택지)
-- ============================================
CREATE TABLE IF NOT EXISTS public.meeting_poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.meeting_posts(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- meeting_poll_options 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_meeting_poll_options_post_id ON public.meeting_poll_options(post_id);

-- ============================================
-- 10. MEETING_VOTES 테이블 (투표)
-- ============================================
CREATE TABLE IF NOT EXISTS public.meeting_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.meeting_posts(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.meeting_poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(option_id, user_id) -- 같은 옵션에 중복 투표 방지 (allow_multiple로 여러 옵션 선택은 가능)
);

-- meeting_votes 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_meeting_votes_post_id ON public.meeting_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_meeting_votes_option_id ON public.meeting_votes(option_id);
CREATE INDEX IF NOT EXISTS idx_meeting_votes_user_id ON public.meeting_votes(user_id);

-- ============================================
-- 11. 기존 하드코딩 그룹을 groups 테이블로 마이그레이션
-- ============================================
INSERT INTO public.groups (name) VALUES
    ('남자_매니저_대화'),
    ('여자_매니저_대화'),
    ('여자_매니저_소개')
ON CONFLICT (name) DO NOTHING;


-- ============================================
-- ROW LEVEL SECURITY (RLS) 정책
-- ============================================

-- 모든 신규 테이블에 RLS 활성화
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_target_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_votes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- GROUPS 테이블 RLS 정책
-- 모든 인증 사용자 읽기 가능, 관리자만 생성/수정/삭제
-- --------------------------------------------
CREATE POLICY "groups_select_authenticated" ON public.groups
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "groups_insert_admin" ON public.groups
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "groups_update_admin" ON public.groups
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "groups_delete_admin" ON public.groups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------
-- USER_GROUPS 테이블 RLS 정책
-- 본인 것만 읽기 가능, 관리자는 모두 CRUD
-- --------------------------------------------
CREATE POLICY "user_groups_select_own_or_admin" ON public.user_groups
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "user_groups_insert_admin" ON public.user_groups
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "user_groups_update_admin" ON public.user_groups
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "user_groups_delete_admin" ON public.user_groups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------
-- POST_TARGET_USERS 테이블 RLS 정책
-- 본인 대상만 읽기 가능, 관리자만 CRUD
-- --------------------------------------------
CREATE POLICY "post_target_users_select_own_or_admin" ON public.post_target_users
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "post_target_users_insert_admin" ON public.post_target_users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "post_target_users_update_admin" ON public.post_target_users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "post_target_users_delete_admin" ON public.post_target_users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------
-- MEETING_POSTS 테이블 RLS 정책
-- 모든 인증 사용자 읽기/생성 가능, 작성자 또는 관리자만 수정/삭제
-- --------------------------------------------
CREATE POLICY "meeting_posts_select_authenticated" ON public.meeting_posts
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "meeting_posts_insert_authenticated" ON public.meeting_posts
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND auth.uid() = author_id
    );

CREATE POLICY "meeting_posts_update_author_or_admin" ON public.meeting_posts
    FOR UPDATE
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "meeting_posts_delete_author_or_admin" ON public.meeting_posts
    FOR DELETE
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------
-- MEETING_COMMENTS 테이블 RLS 정책
-- 모든 인증 사용자 읽기/생성 가능, 작성자 또는 관리자만 삭제
-- --------------------------------------------
CREATE POLICY "meeting_comments_select_authenticated" ON public.meeting_comments
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "meeting_comments_insert_authenticated" ON public.meeting_comments
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND auth.uid() = author_id
    );

CREATE POLICY "meeting_comments_delete_author_or_admin" ON public.meeting_comments
    FOR DELETE
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------
-- MEETING_POLL_OPTIONS 테이블 RLS 정책
-- 모든 인증 사용자 읽기 가능, 관리자만 CRUD
-- --------------------------------------------
CREATE POLICY "meeting_poll_options_select_authenticated" ON public.meeting_poll_options
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "meeting_poll_options_insert_authenticated" ON public.meeting_poll_options
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND EXISTS (
            SELECT 1 FROM public.meeting_posts
            WHERE id = post_id AND author_id = auth.uid()
        )
    );

CREATE POLICY "meeting_poll_options_update_author_or_admin" ON public.meeting_poll_options
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.meeting_posts
            WHERE id = post_id AND author_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.meeting_posts
            WHERE id = post_id AND author_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "meeting_poll_options_delete_author_or_admin" ON public.meeting_poll_options
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.meeting_posts
            WHERE id = post_id AND author_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------
-- MEETING_VOTES 테이블 RLS 정책
-- 모든 인증 사용자 읽기 가능 (투표 집계용), 본인만 투표/취소
-- --------------------------------------------
CREATE POLICY "meeting_votes_select_authenticated" ON public.meeting_votes
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "meeting_votes_insert_own" ON public.meeting_votes
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND auth.uid() = user_id
    );

CREATE POLICY "meeting_votes_delete_own" ON public.meeting_votes
    FOR DELETE
    USING (auth.uid() = user_id);
