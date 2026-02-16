-- Created: 2026-02-14 12:00:00
-- Migration: Add post-test features (wrong answer reviews, retest assignments, test visibility)

-- 1. Create wrong_answer_reviews table
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

-- Indexes for wrong_answer_reviews
CREATE INDEX IF NOT EXISTS idx_wrong_answer_reviews_user_id ON public.wrong_answer_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answer_reviews_test_result_id ON public.wrong_answer_reviews(test_result_id);

-- Enable RLS for wrong_answer_reviews
ALTER TABLE public.wrong_answer_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wrong_answer_reviews
CREATE POLICY "Users can select their own wrong answer reviews"
    ON public.wrong_answer_reviews
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wrong answer reviews"
    ON public.wrong_answer_reviews
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can select all wrong answer reviews"
    ON public.wrong_answer_reviews
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 2. Create retest_assignments table
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

-- Indexes for retest_assignments
CREATE INDEX IF NOT EXISTS idx_retest_assignments_manager_id ON public.retest_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_retest_assignments_status ON public.retest_assignments(status);

-- Enable RLS for retest_assignments
ALTER TABLE public.retest_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retest_assignments
CREATE POLICY "Admins can do everything on retest assignments"
    ON public.retest_assignments
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

CREATE POLICY "Managers can select their own retest assignments"
    ON public.retest_assignments
    FOR SELECT
    USING (auth.uid() = manager_id);

CREATE POLICY "Managers can update their own retest assignments"
    ON public.retest_assignments
    FOR UPDATE
    USING (auth.uid() = manager_id)
    WITH CHECK (auth.uid() = manager_id);

-- 3. Add test_visibility column to educational_posts
ALTER TABLE public.educational_posts
    ADD COLUMN IF NOT EXISTS test_visibility TEXT NOT NULL DEFAULT 'all'
    CHECK (test_visibility IN ('all', 'targeted'));
