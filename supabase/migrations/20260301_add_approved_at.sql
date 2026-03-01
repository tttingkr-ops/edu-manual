-- 승인 날짜 컬럼 추가: 관리자가 게시글을 승인한 시점 기록
ALTER TABLE public.educational_posts
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;

-- 기존 승인된 게시물의 approved_at을 updated_at으로 설정
UPDATE public.educational_posts
SET approved_at = updated_at
WHERE approval_status = 'approved' AND approved_at IS NULL;
