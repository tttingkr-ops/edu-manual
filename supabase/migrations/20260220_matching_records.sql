-- Created: 2026-02-20 00:00:00
-- 소개성과측정 데이터 저장 테이블 (intro_records, matching_records)

-- ============================================
-- 1. INTRO_RECORDS 테이블 (소개 데이터)
-- ============================================
CREATE TABLE IF NOT EXISTS public.intro_records (
  id BIGSERIAL PRIMARY KEY,
  record_date DATE NOT NULL,       -- 시트명에서 추출한 날짜 (예: 2025-04-16)
  no_code TEXT NOT NULL,           -- NO 컬럼 값 (예: F100102, M200345)
  staff TEXT,                      -- 담당자
  manager TEXT,                    -- 매니저
  raw_data JSONB,                  -- 원본 행 전체 데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_date, no_code)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_intro_records_date ON public.intro_records(record_date);
CREATE INDEX IF NOT EXISTS idx_intro_records_staff ON public.intro_records(staff);

-- ============================================
-- 2. MATCHING_RECORDS 테이블 (매칭 데이터)
-- ============================================
CREATE TABLE IF NOT EXISTS public.matching_records (
  id BIGSERIAL PRIMARY KEY,
  matching_date DATE,              -- 날짜 컬럼 (매칭 발생일)
  intro_date TEXT NOT NULL DEFAULT '',   -- 소개시점 (문자열, null이면 '')
  no_f TEXT NOT NULL DEFAULT '',         -- no. 컬럼 (여성 번호, null이면 '')
  no_m TEXT NOT NULL DEFAULT '',         -- no..1 컬럼 (남성 번호, null이면 '')
  process_status TEXT,             -- 처리상태
  raw_data JSONB,                  -- 원본 행 전체 데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(intro_date, no_f, no_m)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_matching_records_matching_date ON public.matching_records(matching_date);
CREATE INDEX IF NOT EXISTS idx_matching_records_intro_date ON public.matching_records(intro_date);
CREATE INDEX IF NOT EXISTS idx_matching_records_status ON public.matching_records(process_status);

-- ============================================
-- 3. RLS (관리자만 접근 가능)
-- ============================================
ALTER TABLE public.intro_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_records ENABLE ROW LEVEL SECURITY;

-- intro_records: 관리자만 전체 권한
CREATE POLICY "admin_all_intro_records" ON public.intro_records
  FOR ALL
  TO authenticated
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

-- matching_records: 관리자만 전체 권한
CREATE POLICY "admin_all_matching_records" ON public.matching_records
  FOR ALL
  TO authenticated
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
