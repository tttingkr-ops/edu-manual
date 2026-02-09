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
          sub_category: string | null;
          external_link: string | null;
          created_at: string;
          updated_at: string;
          author_id: string;
          images: Json;
        };
        Insert: {
          id?: string;
          title: string;
          content_type: 'video' | 'document';
          content: string;
          category: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙';
          sub_category?: string | null;
          external_link?: string | null;
          created_at?: string;
          updated_at?: string;
          author_id: string;
          images?: Json;
        };
        Update: {
          id?: string;
          title?: string;
          content_type?: 'video' | 'document';
          content?: string;
          category?: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙';
          sub_category?: string | null;
          external_link?: string | null;
          created_at?: string;
          updated_at?: string;
          author_id?: string;
          images?: Json;
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
          options: Json | null;
          correct_answer: number | null;
          related_post_id: string | null;
          question_type: 'multiple_choice' | 'subjective';
          max_score: number;
          grading_criteria: string | null;
          model_answer: string | null;
          question_image_url: string | null;
        };
        Insert: {
          id?: string;
          category: string;
          sub_category?: string | null;
          question: string;
          options?: Json | null;
          correct_answer?: number | null;
          related_post_id?: string | null;
          question_type?: 'multiple_choice' | 'subjective';
          max_score?: number;
          grading_criteria?: string | null;
          model_answer?: string | null;
          question_image_url?: string | null;
        };
        Update: {
          id?: string;
          category?: string;
          sub_category?: string | null;
          question?: string;
          options?: Json | null;
          correct_answer?: number | null;
          related_post_id?: string | null;
          question_type?: 'multiple_choice' | 'subjective';
          max_score?: number;
          grading_criteria?: string | null;
          model_answer?: string | null;
          question_image_url?: string | null;
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
      subjective_answers: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          test_result_id: string | null;
          answer_text: string | null;
          image_url: string | null;
          image_path: string | null;
          ai_score: number | null;
          ai_feedback: string | null;
          ai_graded_at: string | null;
          admin_score: number | null;
          admin_feedback: string | null;
          admin_reviewed_at: string | null;
          admin_reviewer_id: string | null;
          final_score: number | null;
          status: 'pending' | 'ai_graded' | 'admin_reviewed';
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          test_result_id?: string | null;
          answer_text?: string | null;
          image_url?: string | null;
          image_path?: string | null;
          ai_score?: number | null;
          ai_feedback?: string | null;
          ai_graded_at?: string | null;
          admin_score?: number | null;
          admin_feedback?: string | null;
          admin_reviewed_at?: string | null;
          admin_reviewer_id?: string | null;
          final_score?: number | null;
          status?: 'pending' | 'ai_graded' | 'admin_reviewed';
          created_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          user_id?: string;
          test_result_id?: string | null;
          answer_text?: string | null;
          image_url?: string | null;
          image_path?: string | null;
          ai_score?: number | null;
          ai_feedback?: string | null;
          ai_graded_at?: string | null;
          admin_score?: number | null;
          admin_feedback?: string | null;
          admin_reviewed_at?: string | null;
          admin_reviewer_id?: string | null;
          final_score?: number | null;
          status?: 'pending' | 'ai_graded' | 'admin_reviewed';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subjective_answers_question_id_fkey';
            columns: ['question_id'];
            referencedRelation: 'test_questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subjective_answers_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subjective_answers_test_result_id_fkey';
            columns: ['test_result_id'];
            referencedRelation: 'test_results';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subjective_answers_admin_reviewer_id_fkey';
            columns: ['admin_reviewer_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      sub_categories: {
        Row: {
          id: string;
          category: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
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
