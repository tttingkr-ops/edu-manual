-- Created: 2026-02-12 00:00:00
-- 회의 안건방 - 완료 상태, 긴급도, 데드라인 기능 추가

-- status: 안건 논의 완료 여부 (pending=미완, completed=완료)
ALTER TABLE public.meeting_posts
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'completed'));

-- priority: 긴급도 (선택사항)
ALTER TABLE public.meeting_posts
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT NULL
CHECK (priority IS NULL OR priority IN ('urgent', 'high', 'normal', 'low'));

-- deadline: 데드라인 (선택사항)
ALTER TABLE public.meeting_posts
ADD COLUMN IF NOT EXISTS deadline DATE DEFAULT NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_meeting_posts_status ON public.meeting_posts(status);
CREATE INDEX IF NOT EXISTS idx_meeting_posts_priority ON public.meeting_posts(priority);
CREATE INDEX IF NOT EXISTS idx_meeting_posts_deadline ON public.meeting_posts(deadline);
