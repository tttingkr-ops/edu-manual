-- Created: 2026-02-12 00:00:00
-- 교육 게시물 댓글 테이블 생성 + 회의 댓글 닉네임 컬럼 추가

-- 1. education_comments 테이블 생성
CREATE TABLE IF NOT EXISTS education_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES educational_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  display_nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_education_comments_post_id ON education_comments(post_id);
CREATE INDEX idx_education_comments_author_id ON education_comments(author_id);

-- RLS 활성화
ALTER TABLE education_comments ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 인증 사용자 읽기
CREATE POLICY "Authenticated users can read education comments"
  ON education_comments FOR SELECT
  TO authenticated
  USING (true);

-- RLS 정책: 인증 사용자 작성
CREATE POLICY "Authenticated users can insert education comments"
  ON education_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- RLS 정책: 작성자 또는 admin만 삭제
CREATE POLICY "Authors and admins can delete education comments"
  ON education_comments FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 2. meeting_comments 테이블에 display_nickname 컬럼 추가
ALTER TABLE meeting_comments ADD COLUMN IF NOT EXISTS display_nickname TEXT;
