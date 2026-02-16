-- Created: 2026-02-17 10:00:00
-- 매니저 교육 게시물 관리자 승인 시스템

-- approval_status 컬럼 추가 (기존 게시물은 모두 approved)
ALTER TABLE public.educational_posts
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('approved', 'pending'));

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_educational_posts_approval_status ON public.educational_posts(approval_status);
