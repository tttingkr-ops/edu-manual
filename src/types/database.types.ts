// Created: 2026-01-27 16:15:00
// 팅팅팅 내부 교육 시스템 - Supabase Database 타입 정의
// 이 파일은 Supabase CLI로 자동 생성할 수 있습니다: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          role: 'admin' | 'manager';
          name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          role: 'admin' | 'manager';
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          role?: 'admin' | 'manager';
          name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      educational_posts: {
        Row: {
          id: string;
          title: string;
          content_type: 'video' | 'document';
          content: string;
          category: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙';
          created_at: string;
          updated_at: string;
          author_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          content_type: 'video' | 'document';
          content: string;
          category: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙';
          created_at?: string;
          updated_at?: string;
          author_id: string;
        };
        Update: {
          id?: string;
          title?: string;
          content_type?: 'video' | 'document';
          content?: string;
          category?: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙';
          created_at?: string;
          updated_at?: string;
          author_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'educational_posts_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      post_groups: {
        Row: {
          id: string;
          post_id: string;
          group_name: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개';
        };
        Insert: {
          id?: string;
          post_id: string;
          group_name: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개';
        };
        Update: {
          id?: string;
          post_id?: string;
          group_name?: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개';
        };
        Relationships: [
          {
            foreignKeyName: 'post_groups_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'educational_posts';
            referencedColumns: ['id'];
          }
        ];
      };
      read_status: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          is_read: boolean;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          is_read?: boolean;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string;
          is_read?: boolean;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'read_status_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'read_status_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'educational_posts';
            referencedColumns: ['id'];
          }
        ];
      };
      test_questions: {
        Row: {
          id: string;
          category: string;
          sub_category: string | null;
          question: string;
          options: Json;
          correct_answer: number;
          related_post_id: string | null;
        };
        Insert: {
          id?: string;
          category: string;
          sub_category?: string | null;
          question: string;
          options: Json;
          correct_answer: number;
          related_post_id?: string | null;
        };
        Update: {
          id?: string;
          category?: string;
          sub_category?: string | null;
          question?: string;
          options?: Json;
          correct_answer?: number;
          related_post_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'test_questions_related_post_id_fkey';
            columns: ['related_post_id'];
            referencedRelation: 'educational_posts';
            referencedColumns: ['id'];
          }
        ];
      };
      test_results: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          score: number;
          correct_count: number;
          total_count: number;
          category_scores: Json | null;
          test_date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          score: number;
          correct_count: number;
          total_count: number;
          category_scores?: Json | null;
          test_date?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category?: string;
          score?: number;
          correct_count?: number;
          total_count?: number;
          category_scores?: Json | null;
          test_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'test_results_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      user_reading_progress: {
        Row: {
          user_id: string | null;
          user_name: string | null;
          total_posts: number | null;
          read_posts: number | null;
          progress_percentage: number | null;
        };
        Relationships: [];
      };
      posts_by_category: {
        Row: {
          category: string | null;
          post_count: number | null;
          video_count: number | null;
          document_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_user_average_score: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          average_score: number;
          total_tests: number;
          best_score: number;
          latest_score: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// 편의 타입 내보내기
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
