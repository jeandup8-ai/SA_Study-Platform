export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["admin_role"]
        }
        Insert: {
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["admin_role"]
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role"]
        }
        Relationships: []
      }
      assessment_answers: {
        Row: {
          answer_text: string | null
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean
          question_id: string
          selected_option_id: string | null
        }
        Insert: {
          answer_text?: string | null
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean
          question_id: string
          selected_option_id?: string | null
        }
        Update: {
          answer_text?: string | null
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          assessment_id: string
          completed_at: string | null
          id: string
          learner_id: string
          score: number | null
          started_at: string
          total_questions: number
        }
        Insert: {
          assessment_id: string
          completed_at?: string | null
          id?: string
          learner_id: string
          score?: number | null
          started_at?: string
          total_questions?: number
        }
        Update: {
          assessment_id?: string
          completed_at?: string | null
          id?: string
          learner_id?: string
          score?: number | null
          started_at?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          question_id: string
          sort_order: number
        }
        Insert: {
          assessment_id: string
          question_id: string
          sort_order?: number
        }
        Update: {
          assessment_id?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string
          grade_id: string
          id: string
          is_demo_content: boolean
          language: Database["public"]["Enums"]["language_code"]
          lesson_id: string | null
          subject_id: string
          term_id: string | null
          title: string
          topic_id: string | null
          type: Database["public"]["Enums"]["assessment_type"]
        }
        Insert: {
          created_at?: string
          grade_id: string
          id?: string
          is_demo_content?: boolean
          language?: Database["public"]["Enums"]["language_code"]
          lesson_id?: string | null
          subject_id: string
          term_id?: string | null
          title: string
          topic_id?: string | null
          type: Database["public"]["Enums"]["assessment_type"]
        }
        Update: {
          created_at?: string
          grade_id?: string
          id?: string
          is_demo_content?: boolean
          language?: Database["public"]["Enums"]["language_code"]
          lesson_id?: string | null
          subject_id?: string
          term_id?: string | null
          title?: string
          topic_id?: string | null
          type?: Database["public"]["Enums"]["assessment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "assessments_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      curricula: {
        Row: {
          code: string
          country: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      exam_periods: {
        Row: {
          created_at: string
          ends_on: string | null
          grade_id: string
          id: string
          name: string
          starts_on: string | null
          subject_id: string
          term_id: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          grade_id: string
          id?: string
          name: string
          starts_on?: string | null
          subject_id: string
          term_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          grade_id?: string
          id?: string
          name?: string
          starts_on?: string | null
          subject_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_periods_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_periods_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_periods_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_readiness: {
        Row: {
          id: string
          learner_id: string
          needs_revision_topic_ids: string[]
          readiness_score: number
          recommended_session_minutes: number
          recommended_sessions_per_week: number
          strong_topic_ids: string[]
          subject_id: string
          term_id: string | null
          updated_at: string
          weak_topic_ids: string[]
        }
        Insert: {
          id?: string
          learner_id: string
          needs_revision_topic_ids?: string[]
          readiness_score?: number
          recommended_session_minutes?: number
          recommended_sessions_per_week?: number
          strong_topic_ids?: string[]
          subject_id: string
          term_id?: string | null
          updated_at?: string
          weak_topic_ids?: string[]
        }
        Update: {
          id?: string
          learner_id?: string
          needs_revision_topic_ids?: string[]
          readiness_score?: number
          recommended_session_minutes?: number
          recommended_sessions_per_week?: number
          strong_topic_ids?: string[]
          subject_id?: string
          term_id?: string | null
          updated_at?: string
          weak_topic_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "exam_readiness_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_readiness_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_readiness_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_subjects: {
        Row: {
          grade_id: string
          sort_order: number
          subject_id: string
        }
        Insert: {
          grade_id: string
          sort_order?: number
          subject_id: string
        }
        Update: {
          grade_id?: string
          sort_order?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_subjects_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          created_at: string
          curriculum_id: string
          grade_number: number
          id: string
          is_launched: boolean
          name: string
        }
        Insert: {
          created_at?: string
          curriculum_id: string
          grade_number: number
          id?: string
          is_launched?: boolean
          name: string
        }
        Update: {
          created_at?: string
          curriculum_id?: string
          grade_number?: number
          id?: string
          is_launched?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_progress: {
        Row: {
          completed_at: string | null
          id: string
          learner_id: string
          lesson_id: string
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          learner_id: string
          lesson_id: string
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          learner_id?: string
          lesson_id?: string
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_progress_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          avatar: Database["public"]["Enums"]["learner_avatar"]
          birth_year: number | null
          created_at: string
          curriculum_id: string
          display_name: string
          grade_id: string
          id: string
          parent_id: string
          preferred_language: Database["public"]["Enums"]["language_code"]
          updated_at: string
        }
        Insert: {
          avatar?: Database["public"]["Enums"]["learner_avatar"]
          birth_year?: number | null
          created_at?: string
          curriculum_id: string
          display_name: string
          grade_id: string
          id?: string
          parent_id: string
          preferred_language?: Database["public"]["Enums"]["language_code"]
          updated_at?: string
        }
        Update: {
          avatar?: Database["public"]["Enums"]["learner_avatar"]
          birth_year?: number | null
          created_at?: string
          curriculum_id?: string
          display_name?: string
          grade_id?: string
          id?: string
          parent_id?: string
          preferred_language?: Database["public"]["Enums"]["language_code"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learners_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learners_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learners_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_objectives: {
        Row: {
          created_at: string
          description: string
          id: string
          language: Database["public"]["Enums"]["language_code"]
          sort_order: number
          subtopic_id: string | null
          topic_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          sort_order?: number
          subtopic_id?: string | null
          topic_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          sort_order?: number
          subtopic_id?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_objectives_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_objectives_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content: {
        Row: {
          body_markdown: string | null
          created_at: string
          heading: string | null
          id: string
          language: Database["public"]["Enums"]["language_code"]
          lesson_id: string
          section_type: Database["public"]["Enums"]["lesson_section_type"]
          sort_order: number
        }
        Insert: {
          body_markdown?: string | null
          created_at?: string
          heading?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          lesson_id: string
          section_type: Database["public"]["Enums"]["lesson_section_type"]
          sort_order?: number
        }
        Update: {
          body_markdown?: string | null
          created_at?: string
          heading?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          lesson_id?: string
          section_type?: Database["public"]["Enums"]["lesson_section_type"]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          estimated_minutes: number
          id: string
          is_demo_content: boolean
          language: Database["public"]["Enums"]["language_code"]
          slug: string
          sort_order: number
          subtopic_id: string | null
          title: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          is_demo_content?: boolean
          language?: Database["public"]["Enums"]["language_code"]
          slug: string
          sort_order?: number
          subtopic_id?: string | null
          title: string
          topic_id: string
        }
        Update: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          is_demo_content?: boolean
          language?: Database["public"]["Enums"]["language_code"]
          slug?: string
          sort_order?: number
          subtopic_id?: string | null
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery: {
        Row: {
          attempts_count: number
          id: string
          last_practised_at: string | null
          learner_id: string
          mastery_score: number
          topic_id: string
          updated_at: string
        }
        Insert: {
          attempts_count?: number
          id?: string
          last_practised_at?: string | null
          learner_id: string
          mastery_score?: number
          topic_id: string
          updated_at?: string
        }
        Update: {
          attempts_count?: number
          id?: string
          last_practised_at?: string | null
          learner_id?: string
          mastery_score?: number
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_weakness_signals: {
        Row: {
          confidence: number
          created_at: string
          description: string
          id: string
          learner_id: string
          signal_code: string
          topic_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          description: string
          id?: string
          learner_id: string
          signal_code: string
          topic_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          description?: string
          id?: string
          learner_id?: string
          signal_code?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_weakness_signals_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_weakness_signals_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          age_rating: string
          approval_status: Database["public"]["Enums"]["media_approval_status"]
          created_at: string
          duration_seconds: number | null
          embed_url: string | null
          grade_id: string | null
          id: string
          language: Database["public"]["Enums"]["language_code"]
          lesson_id: string | null
          license_status: string | null
          media_type: Database["public"]["Enums"]["media_type"]
          provider: string
          source: string | null
          subject_id: string | null
          topic_id: string | null
          url: string | null
        }
        Insert: {
          age_rating?: string
          approval_status?: Database["public"]["Enums"]["media_approval_status"]
          created_at?: string
          duration_seconds?: number | null
          embed_url?: string | null
          grade_id?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          lesson_id?: string | null
          license_status?: string | null
          media_type: Database["public"]["Enums"]["media_type"]
          provider?: string
          source?: string | null
          subject_id?: string | null
          topic_id?: string | null
          url?: string | null
        }
        Update: {
          age_rating?: string
          approval_status?: Database["public"]["Enums"]["media_approval_status"]
          created_at?: string
          duration_seconds?: number | null
          embed_url?: string | null
          grade_id?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          lesson_id?: string | null
          license_status?: string | null
          media_type?: Database["public"]["Enums"]["media_type"]
          provider?: string
          source?: string | null
          subject_id?: string | null
          topic_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          content_type: Database["public"]["Enums"]["moderation_content_type"]
          created_at: string
          decision: Database["public"]["Enums"]["moderation_decision"]
          id: string
          learner_id: string | null
          parent_id: string | null
          provider: string
          reasons: Json
        }
        Insert: {
          content_type: Database["public"]["Enums"]["moderation_content_type"]
          created_at?: string
          decision?: Database["public"]["Enums"]["moderation_decision"]
          id?: string
          learner_id?: string | null
          parent_id?: string | null
          provider?: string
          reasons?: Json
        }
        Update: {
          content_type?: Database["public"]["Enums"]["moderation_content_type"]
          created_at?: string
          decision?: Database["public"]["Enums"]["moderation_decision"]
          id?: string
          learner_id?: string | null
          parent_id?: string | null
          provider?: string
          reasons?: Json
        }
        Relationships: [
          {
            foreignKeyName: "moderation_logs_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_logs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          preferred_language: Database["public"]["Enums"]["language_code"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          updated_at?: string
        }
        Relationships: []
      }
      question_options: {
        Row: {
          id: string
          is_correct: boolean
          label: string
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_correct?: boolean
          label: string
          question_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_correct?: boolean
          label?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          explanation: string | null
          grade_id: string
          id: string
          is_demo_content: boolean
          language: Database["public"]["Enums"]["language_code"]
          learning_objective_id: string | null
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          subject_id: string
          subtopic_id: string | null
          term_id: string | null
          topic_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          explanation?: string | null
          grade_id: string
          id?: string
          is_demo_content?: boolean
          language?: Database["public"]["Enums"]["language_code"]
          learning_objective_id?: string | null
          prompt: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id: string
          subtopic_id?: string | null
          term_id?: string | null
          topic_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          explanation?: string | null
          grade_id?: string
          id?: string
          is_demo_content?: boolean
          language?: Database["public"]["Enums"]["language_code"]
          learning_objective_id?: string | null
          prompt?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id?: string
          subtopic_id?: string | null
          term_id?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          id: string
          learner_id: string
          lesson_id: string | null
          started_at: string
          subject_id: string | null
          topic_id: string | null
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          learner_id: string
          lesson_id?: string | null
          started_at?: string
          subject_id?: string | null
          topic_id?: string | null
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          learner_id?: string
          lesson_id?: string | null
          started_at?: string
          subject_id?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          color_key: string | null
          created_at: string
          curriculum_id: string
          icon_key: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          color_key?: string | null
          created_at?: string
          curriculum_id: string
          icon_key?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          color_key?: string | null
          created_at?: string
          curriculum_id?: string
          icon_key?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          code: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          max_learners: number
          name: string
          price_cents: number | null
        }
        Insert: {
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          code: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_learners?: number
          name: string
          price_cents?: number | null
        }
        Update: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          code?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_learners?: number
          name?: string
          price_cents?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          parent_id: string
          plan_id: string | null
          promo_code: string | null
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          parent_id: string
          plan_id?: string | null
          promo_code?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          parent_id?: string
          plan_id?: string | null
          promo_code?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          topic_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          topic_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          grade_id: string
          id: string
          name: string
          term_number: number
        }
        Insert: {
          created_at?: string
          grade_id: string
          id?: string
          name: string
          term_number: number
        }
        Update: {
          created_at?: string
          grade_id?: string
          id?: string
          name?: string
          term_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "terms_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          code: string
          created_at: string
          description: string | null
          grade_id: string
          id: string
          is_demo_content: boolean
          name: string
          sort_order: number
          subject_id: string
          term_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          grade_id: string
          id?: string
          is_demo_content?: boolean
          name: string
          sort_order?: number
          subject_id: string
          term_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          grade_id?: string
          id?: string
          is_demo_content?: boolean
          name?: string
          sort_order?: number
          subject_id?: string
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      admin_role: "content_admin" | "super_admin"
      assessment_type: "mini_quiz" | "quiz" | "test" | "mock_exam"
      audit_actor_type: "parent" | "admin" | "system"
      billing_interval: "monthly" | "annual"
      language_code:
        | "en"
        | "af"
        | "zu"
        | "xh"
        | "nr"
        | "nso"
        | "st"
        | "tn"
        | "ss"
        | "ve"
        | "ts"
      learner_avatar:
        | "fox"
        | "owl"
        | "lion"
        | "elephant"
        | "zebra"
        | "meerkat"
        | "tortoise"
        | "eagle"
      lesson_section_type:
        | "what_are_we_learning"
        | "simple_explanation"
        | "visual_explanation"
        | "example"
        | "try_it_yourself"
        | "practice_questions"
        | "mini_quiz"
        | "what_did_you_learn"
        | "mastery_result"
        | "next_step"
      media_approval_status: "pending" | "approved" | "rejected"
      media_type:
        | "svg_animation"
        | "interactive_demo"
        | "own_video"
        | "external_video"
        | "youtube_embed"
        | "audio_narration"
        | "image"
        | "diagram"
      moderation_content_type: "image" | "pdf" | "text"
      moderation_decision: "approved" | "rejected" | "pending"
      progress_status: "not_started" | "in_progress" | "completed"
      question_difficulty: "easy" | "medium" | "hard"
      question_type:
        | "multiple_choice"
        | "true_false"
        | "short_answer"
        | "numeric"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["content_admin", "super_admin"],
      assessment_type: ["mini_quiz", "quiz", "test", "mock_exam"],
      audit_actor_type: ["parent", "admin", "system"],
      billing_interval: ["monthly", "annual"],
      language_code: [
        "en",
        "af",
        "zu",
        "xh",
        "nr",
        "nso",
        "st",
        "tn",
        "ss",
        "ve",
        "ts",
      ],
      learner_avatar: [
        "fox",
        "owl",
        "lion",
        "elephant",
        "zebra",
        "meerkat",
        "tortoise",
        "eagle",
      ],
      lesson_section_type: [
        "what_are_we_learning",
        "simple_explanation",
        "visual_explanation",
        "example",
        "try_it_yourself",
        "practice_questions",
        "mini_quiz",
        "what_did_you_learn",
        "mastery_result",
        "next_step",
      ],
      media_approval_status: ["pending", "approved", "rejected"],
      media_type: [
        "svg_animation",
        "interactive_demo",
        "own_video",
        "external_video",
        "youtube_embed",
        "audio_narration",
        "image",
        "diagram",
      ],
      moderation_content_type: ["image", "pdf", "text"],
      moderation_decision: ["approved", "rejected", "pending"],
      progress_status: ["not_started", "in_progress", "completed"],
      question_difficulty: ["easy", "medium", "hard"],
      question_type: [
        "multiple_choice",
        "true_false",
        "short_answer",
        "numeric",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
    },
  },
} as const
