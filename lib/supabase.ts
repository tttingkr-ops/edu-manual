// Created: 2026-01-27 16:15:00
// 팅팅팅 내부 교육 시스템 - Supabase 클라이언트 설정

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL 또는 Anon Key가 설정되지 않았습니다.');
}

// 브라우저용 Supabase 클라이언트 (싱글톤)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// 서버 컴포넌트용 Supabase 클라이언트 생성 함수
export function createServerClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================
// 타입 정의 (Database Types)
// ============================================

// 사용자 역할 타입
export type UserRole = 'admin' | 'manager';

// 콘텐츠 타입
export type ContentType = 'video' | 'document';

// 카테고리 타입
export type Category =
  | '남자_매니저_대화'
  | '여자_매니저_대화'
  | '여자_매니저_소개'
  | '추가_서비스_규칙';

// 그룹 이름 타입
export type GroupName =
  | '남자_매니저_대화'
  | '여자_매니저_대화'
  | '여자_매니저_소개';

// ============================================
// 테이블 Row 타입
// ============================================

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  created_at: string;
}

export interface EducationalPost {
  id: string;
  title: string;
  content_type: ContentType;
  content: string;
  category: Category;
  created_at: string;
  updated_at: string;
  author_id: string;
}

export interface PostGroup {
  id: string;
  post_id: string;
  group_name: GroupName;
}

export interface ReadStatus {
  id: string;
  user_id: string;
  post_id: string;
  is_read: boolean;
  read_at: string | null;
}

export interface TestQuestion {
  id: string;
  category: string;
  sub_category: string | null;
  question: string;
  options: string[]; // JSONB로 저장된 배열
  correct_answer: number; // 0-3
  related_post_id: string | null;
}

export interface TestResult {
  id: string;
  user_id: string;
  category: string;
  score: number;
  correct_count: number;
  total_count: number;
  category_scores: Record<string, number> | null; // JSONB
  test_date: string;
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 현재 로그인한 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error) {
    console.error('사용자 정보 조회 오류:', error);
    return null;
  }

  return data as User;
}

/**
 * 사용자가 관리자인지 확인
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}

/**
 * 카테고리별 교육 게시물 조회
 */
export async function getPostsByCategory(category: Category) {
  const { data, error } = await supabase
    .from('educational_posts')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('게시물 조회 오류:', error);
    return [];
  }

  return data as EducationalPost[];
}

/**
 * 읽음 상태 업데이트
 */
export async function markAsRead(userId: string, postId: string) {
  const { data, error } = await supabase
    .from('read_status')
    .upsert(
      {
        user_id: userId,
        post_id: postId,
        is_read: true,
        read_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,post_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('읽음 상태 업데이트 오류:', error);
    return null;
  }

  return data as ReadStatus;
}

/**
 * 사용자의 읽기 진행률 조회
 */
export async function getUserReadingProgress(userId: string) {
  const { data: totalPosts } = await supabase
    .from('educational_posts')
    .select('id', { count: 'exact' });

  const { data: readPosts } = await supabase
    .from('read_status')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_read', true);

  const total = totalPosts?.length || 0;
  const read = readPosts?.length || 0;

  return {
    total,
    read,
    percentage: total > 0 ? Math.round((read / total) * 100) : 0,
  };
}

/**
 * 카테고리별 테스트 문제 조회
 */
export async function getTestQuestionsByCategory(category: string) {
  const { data, error } = await supabase
    .from('test_questions')
    .select('*')
    .eq('category', category);

  if (error) {
    console.error('테스트 문제 조회 오류:', error);
    return [];
  }

  return data as TestQuestion[];
}

/**
 * 테스트 결과 저장
 */
export async function saveTestResult(result: Omit<TestResult, 'id' | 'test_date'>) {
  const { data, error } = await supabase
    .from('test_results')
    .insert(result)
    .select()
    .single();

  if (error) {
    console.error('테스트 결과 저장 오류:', error);
    return null;
  }

  return data as TestResult;
}

/**
 * 사용자의 테스트 결과 이력 조회
 */
export async function getUserTestHistory(userId: string) {
  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .eq('user_id', userId)
    .order('test_date', { ascending: false });

  if (error) {
    console.error('테스트 결과 조회 오류:', error);
    return [];
  }

  return data as TestResult[];
}

export default supabase;
