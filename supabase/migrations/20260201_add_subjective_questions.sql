-- Created: 2026-02-01 21:30:00
-- 주관식 문제 및 AI 채점 기능 추가 마이그레이션

-- ============================================
-- 1. TEST_QUESTIONS 테이블 필드 추가
-- ============================================
-- question_type 필드 추가 (기본값: multiple_choice)
ALTER TABLE public.test_questions
ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice'
CHECK (question_type IN ('multiple_choice', 'subjective'));

-- max_score 필드 추가 (기본값: 10)
ALTER TABLE public.test_questions
ADD COLUMN IF NOT EXISTS max_score INTEGER NOT NULL DEFAULT 10;

-- grading_criteria 필드 추가 (주관식 채점 기준)
ALTER TABLE public.test_questions
ADD COLUMN IF NOT EXISTS grading_criteria TEXT;

-- model_answer 필드 추가 (주관식 모범 답안)
ALTER TABLE public.test_questions
ADD COLUMN IF NOT EXISTS model_answer TEXT;

-- 기존 options, correct_answer 필드를 nullable로 변경 (주관식은 없음)
ALTER TABLE public.test_questions
ALTER COLUMN options DROP NOT NULL;

ALTER TABLE public.test_questions
ALTER COLUMN correct_answer DROP NOT NULL;

-- correct_answer 체크 제약조건 수정 (NULL 허용)
ALTER TABLE public.test_questions
DROP CONSTRAINT IF EXISTS test_questions_correct_answer_check;

ALTER TABLE public.test_questions
ADD CONSTRAINT test_questions_correct_answer_check
CHECK (correct_answer IS NULL OR (correct_answer >= 0 AND correct_answer <= 3));

-- ============================================
-- 2. SUBJECTIVE_ANSWERS 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS public.subjective_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    test_result_id UUID REFERENCES public.test_results(id) ON DELETE SET NULL,
    answer_text TEXT,
    image_url TEXT,
    image_path TEXT,
    ai_score INTEGER,
    ai_feedback TEXT, -- JSON 형식으로 저장
    ai_graded_at TIMESTAMP WITH TIME ZONE,
    admin_score INTEGER,
    admin_feedback TEXT,
    admin_reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    final_score INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ai_graded', 'admin_reviewed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(question_id, user_id)
);

-- subjective_answers 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_subjective_answers_question_id ON public.subjective_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_subjective_answers_user_id ON public.subjective_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_subjective_answers_status ON public.subjective_answers(status);
CREATE INDEX IF NOT EXISTS idx_subjective_answers_created_at ON public.subjective_answers(created_at DESC);

-- ============================================
-- 3. RLS 정책 설정
-- ============================================
ALTER TABLE public.subjective_answers ENABLE ROW LEVEL SECURITY;

-- 본인 답변 읽기
CREATE POLICY "subjective_answers_select_own" ON public.subjective_answers
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 본인 답변 생성
CREATE POLICY "subjective_answers_insert_own" ON public.subjective_answers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 본인 답변 수정 (아직 admin_reviewed 아닌 경우만)
CREATE POLICY "subjective_answers_update_own" ON public.subjective_answers
    FOR UPDATE
    USING (
        (auth.uid() = user_id AND status != 'admin_reviewed')
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        (auth.uid() = user_id AND status != 'admin_reviewed')
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- 4. STORAGE 버킷 설정 (Supabase Dashboard에서 실행)
-- ============================================
-- 이 부분은 Supabase Dashboard > Storage에서 수동으로 설정해야 합니다:
-- 1. 'answer-images' 버킷 생성
-- 2. Public bucket으로 설정
-- 3. 또는 아래 SQL 실행:

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('answer-images', 'answer-images', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage 정책 (버킷 생성 후 실행)
-- CREATE POLICY "answer_images_insert" ON storage.objects
--     FOR INSERT
--     WITH CHECK (bucket_id = 'answer-images' AND auth.role() = 'authenticated');

-- CREATE POLICY "answer_images_select" ON storage.objects
--     FOR SELECT
--     USING (bucket_id = 'answer-images');

-- CREATE POLICY "answer_images_delete" ON storage.objects
--     FOR DELETE
--     USING (bucket_id = 'answer-images' AND auth.uid()::text = (storage.foldername(name))[1]);
