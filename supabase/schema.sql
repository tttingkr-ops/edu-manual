-- Created: 2026-01-27 16:15:00
-- 팅팅팅 내부 교육 시스템 데이터베이스 스키마
-- Supabase SQL Schema

-- ============================================
-- 1. USERS 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- users 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ============================================
-- 2. EDUCATIONAL_POSTS 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.educational_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'document')),
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('남자_매니저_대화', '여자_매니저_대화', '여자_매니저_소개', '추가_서비스_규칙', '개인_피드백')),
    images JSONB DEFAULT '[]'::jsonb, -- 첨부 이미지 URL 배열
    test_visibility TEXT NOT NULL DEFAULT 'all' CHECK (test_visibility IN ('all', 'targeted')),
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);

-- educational_posts 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_educational_posts_category ON public.educational_posts(category);
CREATE INDEX IF NOT EXISTS idx_educational_posts_author ON public.educational_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_educational_posts_created_at ON public.educational_posts(created_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_educational_posts_updated_at
    BEFORE UPDATE ON public.educational_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. POST_GROUPS 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.post_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.educational_posts(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL CHECK (group_name IN ('남자_매니저_대화', '여자_매니저_대화', '여자_매니저_소개'))
);

-- post_groups 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_post_groups_post_id ON public.post_groups(post_id);
CREATE INDEX IF NOT EXISTS idx_post_groups_group_name ON public.post_groups(group_name);

-- ============================================
-- 4. READ_STATUS 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.educational_posts(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, post_id)
);

-- read_status 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_read_status_user_id ON public.read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_read_status_post_id ON public.read_status(post_id);

-- ============================================
-- 5. TEST_QUESTIONS 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    sub_category TEXT,
    question TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'subjective')),
    question_image_url TEXT, -- 문제에 첨부된 이미지 (카카오톡 대화 캡처 등)
    options JSONB, -- ["옵션1", "옵션2", "옵션3", "옵션4"] (객관식만)
    correct_answer INTEGER CHECK (correct_answer IS NULL OR (correct_answer >= 0 AND correct_answer <= 3)), -- 객관식만
    max_score INTEGER NOT NULL DEFAULT 10,
    grading_criteria TEXT, -- 주관식 채점 기준
    model_answer TEXT, -- 주관식 모범 답안
    related_post_id UUID REFERENCES public.educational_posts(id) ON DELETE SET NULL
);

-- test_questions 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_test_questions_category ON public.test_questions(category);
CREATE INDEX IF NOT EXISTS idx_test_questions_related_post ON public.test_questions(related_post_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_type ON public.test_questions(question_type);

-- ============================================
-- 6. TEST_RESULTS 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    score INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    category_scores JSONB, -- {"남자_매니저_대화": 80, "여자_매니저_대화": 90}
    test_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- test_results 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON public.test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_category ON public.test_results(category);
CREATE INDEX IF NOT EXISTS idx_test_results_test_date ON public.test_results(test_date DESC);

-- ============================================
-- 7. SUBJECTIVE_ANSWERS 테이블 (주관식 답변)
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
    ai_feedback TEXT, -- JSON 형식으로 저장: {feedback, strengths, improvements}
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
-- 8. WRONG_ANSWER_REVIEWS 테이블 (오답 복습 기록)
-- ============================================
CREATE TABLE IF NOT EXISTS public.wrong_answer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    test_result_id UUID NOT NULL REFERENCES public.test_results(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
    original_answer JSONB,
    review_answer JSONB,
    is_correct_on_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- wrong_answer_reviews 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_wrong_answer_reviews_user_id ON public.wrong_answer_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answer_reviews_test_result_id ON public.wrong_answer_reviews(test_result_id);

-- ============================================
-- 9. RETEST_ASSIGNMENTS 테이블 (관리자 재시험 배정)
-- ============================================
CREATE TABLE IF NOT EXISTS public.retest_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category TEXT,
    question_ids JSONB,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- retest_assignments 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_retest_assignments_manager_id ON public.retest_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_retest_assignments_status ON public.retest_assignments(status);


-- ============================================
-- ROW LEVEL SECURITY (RLS) 정책
-- ============================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjective_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrong_answer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retest_assignments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- USERS 테이블 RLS 정책
-- 본인 정보만 읽기 가능, 관리자는 모두 읽기 가능
-- --------------------------------------------
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "users_insert_admin" ON public.users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR auth.uid() = id -- 최초 가입 시 본인 레코드 생성 허용
    );

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- --------------------------------------------
-- EDUCATIONAL_POSTS 테이블 RLS 정책
-- 모두 읽기 가능, 인증된 사용자 생성 가능
-- admin은 모든 글 수정/삭제, manager는 본인 글만 수정/삭제
-- --------------------------------------------
CREATE POLICY "educational_posts_select_all" ON public.educational_posts
    FOR SELECT
    USING (true);

CREATE POLICY "educational_posts_insert_authenticated" ON public.educational_posts
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
    );

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

CREATE POLICY "educational_posts_delete_admin_or_own" ON public.educational_posts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR author_id = auth.uid()
    );

-- --------------------------------------------
-- POST_GROUPS 테이블 RLS 정책
-- 모두 읽기 가능, 관리자만 생성/수정/삭제
-- --------------------------------------------
CREATE POLICY "post_groups_select_all" ON public.post_groups
    FOR SELECT
    USING (true);

CREATE POLICY "post_groups_insert_admin" ON public.post_groups
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "post_groups_delete_admin" ON public.post_groups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------
-- READ_STATUS 테이블 RLS 정책
-- 본인 것만 읽기/쓰기 가능
-- --------------------------------------------
CREATE POLICY "read_status_select_own" ON public.read_status
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "read_status_insert_own" ON public.read_status
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "read_status_update_own" ON public.read_status
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------
-- TEST_QUESTIONS 테이블 RLS 정책
-- 모두 읽기 가능, 관리자만 생성/수정/삭제
-- --------------------------------------------
CREATE POLICY "test_questions_select_all" ON public.test_questions
    FOR SELECT
    USING (true);

CREATE POLICY "test_questions_insert_admin" ON public.test_questions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "test_questions_update_admin" ON public.test_questions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "test_questions_delete_admin" ON public.test_questions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------
-- TEST_RESULTS 테이블 RLS 정책
-- 본인 것만 읽기/쓰기 가능, 관리자는 모두 읽기 가능
-- --------------------------------------------
CREATE POLICY "test_results_select_own_or_admin" ON public.test_results
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "test_results_insert_own" ON public.test_results
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "test_results_update_own" ON public.test_results
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------
-- SUBJECTIVE_ANSWERS 테이블 RLS 정책
-- 본인 것만 읽기/쓰기 가능, 관리자는 모두 읽기/수정 가능
-- --------------------------------------------
CREATE POLICY "subjective_answers_select_own_or_admin" ON public.subjective_answers
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "subjective_answers_insert_own" ON public.subjective_answers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subjective_answers_update_own_or_admin" ON public.subjective_answers
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

-- --------------------------------------------
-- WRONG_ANSWER_REVIEWS 테이블 RLS 정책
-- 본인 것만 읽기/생성, 관리자는 모두 읽기
-- --------------------------------------------
CREATE POLICY "wrong_answer_reviews_select_own_or_admin" ON public.wrong_answer_reviews
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "wrong_answer_reviews_insert_own" ON public.wrong_answer_reviews
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------
-- RETEST_ASSIGNMENTS 테이블 RLS 정책
-- 관리자는 모든 작업, 매니저는 본인 것만 읽기/수정
-- --------------------------------------------
CREATE POLICY "retest_assignments_all_admin" ON public.retest_assignments
    FOR ALL
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

CREATE POLICY "retest_assignments_select_own_manager" ON public.retest_assignments
    FOR SELECT
    USING (auth.uid() = manager_id);

CREATE POLICY "retest_assignments_update_own_manager" ON public.retest_assignments
    FOR UPDATE
    USING (auth.uid() = manager_id)
    WITH CHECK (auth.uid() = manager_id);


-- ============================================
-- 샘플 데이터 INSERT
-- 주의: auth.users에 먼저 사용자가 등록되어야 함
-- 실제 사용 시 UUID를 실제 auth.users의 id로 교체해야 함
-- ============================================

-- 샘플 UUID (테스트용) - 실제 환경에서는 auth.users에서 가져와야 함
-- 아래 INSERT는 Supabase Dashboard에서 사용자 생성 후 실행해야 합니다

/*
-- ============================================
-- 샘플 데이터: USERS
-- auth.users 생성 후 아래 UUID를 실제 값으로 교체하세요
-- ============================================
INSERT INTO public.users (id, username, role, name) VALUES
('11111111-1111-1111-1111-111111111111', 'admin01', 'admin', '관리자 김철수'),
('22222222-2222-2222-2222-222222222222', 'manager01', 'manager', '매니저 이영희'),
('33333333-3333-3333-3333-333333333333', 'manager02', 'manager', '매니저 박지훈'),
('44444444-4444-4444-4444-444444444444', 'manager03', 'manager', '매니저 최수정'),
('55555555-5555-5555-5555-555555555555', 'admin02', 'admin', '관리자 정민수');

-- ============================================
-- 샘플 데이터: EDUCATIONAL_POSTS
-- ============================================
INSERT INTO public.educational_posts (id, title, content_type, content, category, author_id) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '남자 매니저 기본 대화법', 'video', 'https://youtube.com/watch?v=sample1', '남자_매니저_대화', '11111111-1111-1111-1111-111111111111'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '여자 매니저 인사 멘트', 'document', '# 인사 멘트 가이드\n\n안녕하세요! 환영합니다...', '여자_매니저_대화', '11111111-1111-1111-1111-111111111111'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '여자 매니저 자기소개 방법', 'video', 'https://youtube.com/watch?v=sample2', '여자_매니저_소개', '11111111-1111-1111-1111-111111111111'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '추가 서비스 규칙 안내', 'document', '# 추가 서비스 규칙\n\n1. 규칙 1...\n2. 규칙 2...', '추가_서비스_규칙', '55555555-5555-5555-5555-555555555555'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '남자 매니저 고급 대화 기술', 'video', 'https://youtube.com/watch?v=sample3', '남자_매니저_대화', '11111111-1111-1111-1111-111111111111');

-- ============================================
-- 샘플 데이터: POST_GROUPS
-- ============================================
INSERT INTO public.post_groups (post_id, group_name) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '남자_매니저_대화'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '여자_매니저_대화'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '여자_매니저_소개'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '남자_매니저_대화');

-- ============================================
-- 샘플 데이터: READ_STATUS
-- ============================================
INSERT INTO public.read_status (user_id, post_id, is_read, read_at) VALUES
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, NOW() - INTERVAL '2 days'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, NOW() - INTERVAL '1 day'),
('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, NOW()),
('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, NULL),
('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true, NOW() - INTERVAL '3 hours');

-- ============================================
-- 샘플 데이터: TEST_QUESTIONS
-- ============================================
INSERT INTO public.test_questions (id, category, sub_category, question, options, correct_answer, related_post_id) VALUES
('q1111111-1111-1111-1111-111111111111', '남자_매니저_대화', '기본 인사', '고객을 처음 만났을 때 가장 적절한 인사말은?', '["안녕", "어서오세요, 환영합니다!", "뭐 드릴까요?", "네, 말씀하세요"]', 1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('q2222222-2222-2222-2222-222222222222', '여자_매니저_대화', '대화 기술', '고객이 불만을 표현할 때 가장 좋은 대응은?', '["무시한다", "경청하고 공감한다", "변명한다", "다른 직원을 부른다"]', 1, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('q3333333-3333-3333-3333-333333333333', '여자_매니저_소개', '자기소개', '자기소개 시 가장 먼저 언급해야 할 것은?', '["취미", "이름과 담당 업무", "나이", "경력"]', 1, 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
('q4444444-4444-4444-4444-444444444444', '추가_서비스_규칙', '규칙', '추가 서비스 요청 시 반드시 확인해야 할 것은?', '["고객 기분", "승인 여부", "시간", "날씨"]', 1, 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
('q5555555-5555-5555-5555-555555555555', '남자_매니저_대화', '고급 대화', '어려운 요청을 받았을 때 적절한 대응은?', '["즉시 거절", "무조건 수락", "확인 후 답변드리겠다고 안내", "모른척한다"]', 2, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

-- ============================================
-- 샘플 데이터: TEST_RESULTS
-- ============================================
INSERT INTO public.test_results (user_id, category, score, correct_count, total_count, category_scores, test_date) VALUES
('22222222-2222-2222-2222-222222222222', '전체', 85, 17, 20, '{"남자_매니저_대화": 90, "여자_매니저_대화": 80, "여자_매니저_소개": 85, "추가_서비스_규칙": 85}', NOW() - INTERVAL '7 days'),
('22222222-2222-2222-2222-222222222222', '남자_매니저_대화', 90, 9, 10, '{"남자_매니저_대화": 90}', NOW() - INTERVAL '3 days'),
('33333333-3333-3333-3333-333333333333', '전체', 75, 15, 20, '{"남자_매니저_대화": 70, "여자_매니저_대화": 80, "여자_매니저_소개": 75, "추가_서비스_규칙": 75}', NOW() - INTERVAL '5 days'),
('44444444-4444-4444-4444-444444444444', '여자_매니저_소개', 100, 5, 5, '{"여자_매니저_소개": 100}', NOW() - INTERVAL '1 day'),
('44444444-4444-4444-4444-444444444444', '전체', 92, 23, 25, '{"남자_매니저_대화": 95, "여자_매니저_대화": 90, "여자_매니저_소개": 100, "추가_서비스_규칙": 85}', NOW());
*/


-- ============================================
-- 유용한 뷰 (Views)
-- ============================================

-- 사용자별 읽기 진행률 뷰
CREATE OR REPLACE VIEW public.user_reading_progress AS
SELECT
    u.id as user_id,
    u.name as user_name,
    COUNT(DISTINCT ep.id) as total_posts,
    COUNT(DISTINCT CASE WHEN rs.is_read = true THEN rs.post_id END) as read_posts,
    ROUND(
        COUNT(DISTINCT CASE WHEN rs.is_read = true THEN rs.post_id END)::NUMERIC /
        NULLIF(COUNT(DISTINCT ep.id), 0) * 100,
        2
    ) as progress_percentage
FROM public.users u
CROSS JOIN public.educational_posts ep
LEFT JOIN public.read_status rs ON rs.user_id = u.id AND rs.post_id = ep.id
WHERE u.role = 'manager'
GROUP BY u.id, u.name;

-- 카테고리별 게시물 수 뷰
CREATE OR REPLACE VIEW public.posts_by_category AS
SELECT
    category,
    COUNT(*) as post_count,
    COUNT(CASE WHEN content_type = 'video' THEN 1 END) as video_count,
    COUNT(CASE WHEN content_type = 'document' THEN 1 END) as document_count
FROM public.educational_posts
GROUP BY category;


-- ============================================
-- 함수: 사용자의 테스트 평균 점수 조회
-- ============================================
CREATE OR REPLACE FUNCTION get_user_average_score(p_user_id UUID)
RETURNS TABLE(
    average_score NUMERIC,
    total_tests INTEGER,
    best_score INTEGER,
    latest_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROUND(AVG(tr.score)::NUMERIC, 2) as average_score,
        COUNT(*)::INTEGER as total_tests,
        MAX(tr.score)::INTEGER as best_score,
        (SELECT score FROM public.test_results WHERE user_id = p_user_id ORDER BY test_date DESC LIMIT 1)::INTEGER as latest_score
    FROM public.test_results tr
    WHERE tr.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
