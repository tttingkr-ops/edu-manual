-- Created: 2026-02-13 16:05:00
-- education_comments.author_id FK를 auth.users → public.users로 변경
-- meeting_comments와 동일하게 맞춰 클라이언트에서 댓글 작성 가능하도록 수정

ALTER TABLE education_comments DROP CONSTRAINT education_comments_author_id_fkey;
ALTER TABLE education_comments ADD CONSTRAINT education_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;
