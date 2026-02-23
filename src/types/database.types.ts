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
          nickname: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          role: 'admin' | 'manager';
          name: string;
          nickname?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          role?: 'admin' | 'manager';
          name?: string;
          nickname?: string | null;
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
          category: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙' | '개인_피드백';
          sub_category: string | null;
          external_link: string | null;
          targeting_type: 'group' | 'individual';
          created_at: string;
          updated_at: string;
          author_id: string;
          images: Json;
          test_visibility: 'all' | 'targeted';
          approval_status: 'approved' | 'pending';
          display_nickname: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          content_type: 'video' | 'document';
          content: string;
          category: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙' | '개인_피드백';
          sub_category?: string | null;
          external_link?: string | null;
          targeting_type?: 'group' | 'individual';
          created_at?: string;
          updated_at?: string;
          author_id: string;
          images?: Json;
          test_visibility?: 'all' | 'targeted';
          approval_status?: 'approved' | 'pending';
          display_nickname?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          content_type?: 'video' | 'document';
          content?: string;
          category?: '남자_매니저_대화' | '여자_매니저_대화' | '여자_매니저_소개' | '추가_서비스_규칙' | '개인_피드백';
          sub_category?: string | null;
          external_link?: string | null;
          targeting_type?: 'group' | 'individual';
          created_at?: string;
          updated_at?: string;
          author_id?: string;
          images?: Json;
          test_visibility?: 'all' | 'targeted';
          approval_status?: 'approved' | 'pending';
          display_nickname?: string | null;
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
          group_name: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          group_name: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          group_name?: string;
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
          correct_answer: Json | null;
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
          correct_answer?: Json | null;
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
          correct_answer?: Json | null;
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
      best_practice_posts: {
        Row: {
          id: string;
          title: string;
          content: string;
          situation_tag: string | null;
          author_id: string | null;
          targeting_type: 'group' | 'individual';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content?: string;
          situation_tag?: string | null;
          author_id?: string | null;
          targeting_type?: 'group' | 'individual';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          situation_tag?: string | null;
          author_id?: string | null;
          targeting_type?: 'group' | 'individual';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      best_practice_groups: {
        Row: { id: string; post_id: string; group_name: string };
        Insert: { id?: string; post_id: string; group_name: string };
        Update: { id?: string; post_id?: string; group_name?: string };
        Relationships: [];
      };
      best_practice_target_users: {
        Row: { id: string; post_id: string; user_id: string };
        Insert: { id?: string; post_id: string; user_id: string };
        Update: { id?: string; post_id?: string; user_id?: string };
        Relationships: [];
      };
      best_practice_read_status: {
        Row: { id: string; post_id: string; user_id: string; is_read: boolean; read_at: string | null };
        Insert: { id?: string; post_id: string; user_id: string; is_read?: boolean; read_at?: string | null };
        Update: { id?: string; post_id?: string; user_id?: string; is_read?: boolean; read_at?: string | null };
        Relationships: [];
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
      groups: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_groups: {
        Row: {
          id: string;
          user_id: string;
          group_id: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          group_id: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          group_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_groups_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_groups_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          }
        ];
      };
      post_target_users: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'post_target_users_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'educational_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'post_target_users_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      meeting_posts: {
        Row: {
          id: string;
          title: string;
          content: string | null;
          post_type: 'free' | 'poll';
          is_anonymous: boolean;
          allow_multiple: boolean;
          author_id: string;
          status: 'pending' | 'completed';
          priority: 'urgent' | 'high' | 'normal' | 'low' | null;
          deadline: string | null;
          sub_category: string | null;
          created_at: string;
          updated_at: string;
          display_nickname: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          content?: string | null;
          post_type?: 'free' | 'poll';
          is_anonymous?: boolean;
          allow_multiple?: boolean;
          author_id: string;
          status?: 'pending' | 'completed';
          priority?: 'urgent' | 'high' | 'normal' | 'low' | null;
          deadline?: string | null;
          sub_category?: string | null;
          created_at?: string;
          updated_at?: string;
          display_nickname?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string | null;
          post_type?: 'free' | 'poll';
          is_anonymous?: boolean;
          allow_multiple?: boolean;
          author_id?: string;
          status?: 'pending' | 'completed';
          priority?: 'urgent' | 'high' | 'normal' | 'low' | null;
          deadline?: string | null;
          sub_category?: string | null;
          created_at?: string;
          updated_at?: string;
          display_nickname?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_posts_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      meeting_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          content: string;
          display_nickname: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          content: string;
          display_nickname?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          content?: string;
          display_nickname?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_comments_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'meeting_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_comments_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      meeting_poll_options: {
        Row: {
          id: string;
          post_id: string;
          option_text: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          post_id: string;
          option_text: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          post_id?: string;
          option_text?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_poll_options_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'meeting_posts';
            referencedColumns: ['id'];
          }
        ];
      };
      meeting_votes: {
        Row: {
          id: string;
          post_id: string;
          option_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          option_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          option_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_votes_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'meeting_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_votes_option_id_fkey';
            columns: ['option_id'];
            referencedRelation: 'meeting_poll_options';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_votes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      education_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          content: string;
          display_nickname: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          content: string;
          display_nickname?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          content?: string;
          display_nickname?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'education_comments_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'educational_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'education_comments_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      wrong_answer_reviews: {
        Row: {
          id: string;
          user_id: string;
          test_result_id: string;
          question_id: string;
          original_answer: Json | null;
          review_answer: Json | null;
          is_correct_on_review: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          test_result_id: string;
          question_id: string;
          original_answer?: Json | null;
          review_answer?: Json | null;
          is_correct_on_review?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          test_result_id?: string;
          question_id?: string;
          original_answer?: Json | null;
          review_answer?: Json | null;
          is_correct_on_review?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wrong_answer_reviews_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wrong_answer_reviews_test_result_id_fkey';
            columns: ['test_result_id'];
            referencedRelation: 'test_results';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wrong_answer_reviews_question_id_fkey';
            columns: ['question_id'];
            referencedRelation: 'test_questions';
            referencedColumns: ['id'];
          }
        ];
      };
      retest_assignments: {
        Row: {
          id: string;
          admin_id: string;
          manager_id: string;
          category: string | null;
          question_ids: Json | null;
          reason: string | null;
          status: 'pending' | 'completed';
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          admin_id: string;
          manager_id: string;
          category?: string | null;
          question_ids?: Json | null;
          reason?: string | null;
          status?: 'pending' | 'completed';
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          admin_id?: string;
          manager_id?: string;
          category?: string | null;
          question_ids?: Json | null;
          reason?: string | null;
          status?: 'pending' | 'completed';
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'retest_assignments_admin_id_fkey';
            columns: ['admin_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'retest_assignments_manager_id_fkey';
            columns: ['manager_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      intro_records: {
        Row: {
          id: number;
          record_date: string;
          no_code: string;
          staff: string | null;
          manager: string | null;
          raw_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          record_date: string;
          no_code: string;
          staff?: string | null;
          manager?: string | null;
          raw_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          record_date?: string;
          no_code?: string;
          staff?: string | null;
          manager?: string | null;
          raw_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      matching_records: {
        Row: {
          id: number;
          matching_date: string | null;
          intro_date: string;
          no_f: string;
          no_m: string;
          process_status: string | null;
          raw_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          matching_date?: string | null;
          intro_date?: string;
          no_f?: string;
          no_m?: string;
          process_status?: string | null;
          raw_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          matching_date?: string | null;
          intro_date?: string;
          no_f?: string;
          no_m?: string;
          process_status?: string | null;
          raw_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
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
