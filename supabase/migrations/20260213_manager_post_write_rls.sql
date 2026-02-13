-- Created: 2026-02-13 12:00:00
-- 매니저 글쓰기 권한: educational_posts RLS 정책 수정
-- INSERT: 모든 인증 사용자 허용
-- UPDATE/DELETE: admin 전체, manager 본인 글만

-- 기존 정책 삭제
DROP POLICY IF EXISTS "educational_posts_insert_admin" ON public.educational_posts;
DROP POLICY IF EXISTS "educational_posts_update_admin" ON public.educational_posts;
DROP POLICY IF EXISTS "educational_posts_delete_admin" ON public.educational_posts;

-- 새 INSERT 정책: 모든 인증 사용자 허용
CREATE POLICY "educational_posts_insert_authenticated" ON public.educational_posts
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- 새 UPDATE 정책: admin은 모든 글, manager는 본인 글만
CREATE POLICY "educational_posts_update_admin_or_own" ON public.educational_posts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR author_id = auth.uid()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR author_id = auth.uid()
    );

-- 새 DELETE 정책: admin은 모든 글, manager는 본인 글만
CREATE POLICY "educational_posts_delete_admin_or_own" ON public.educational_posts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR author_id = auth.uid()
    );
