export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          id: string
          role: Database['public']['Enums']['admin_role']
        }
        Insert: {
          created_at?: string
          id: string
          role?: Database['public']['Enums']['admin_role']
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database['public']['Enums']['admin_role']
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
            foreignKeyName: 'assessment_answers_attempt_id_fkey'
            columns: ['attempt_id']
            isOneToOne: false
            referencedRelation: 'assessment_attempts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_answers_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_answers_selected_option_id_fkey'
            columns: ['selected_option_id']
            isOneToOne: false
            referencedRelation: 'question_options'
            referencedColumns: ['id']
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
            foreignKeyName: 'assessment_attempts_assessment_id_fkey'
            columns: ['assessment_id']
            isOneToOne: false
            referencedRelation: 'assessments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_attempts_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_notes: {
        Row: {
          category: string
          confidence_score: number | null
          content_workflow_status: Database['public']['Enums']['content_workflow_status']
          created_at: string
          extraction_method: string | null
          grade_id: string | null
          id: string
          import_version: string | null
          secondary_extraction_match: boolean | null
          source_coordinates: Json | null
          source_id: string | null
          source_page: string | null
          source_section: string | null
          source_snippet: string | null
          source_text_hash: string | null
          subject_id: string
          term_id: string | null
          text: string
          validation_confidence: number | null
          validation_method: string[] | null
          validation_reason: string | null
          validation_status: Database['public']['Enums']['curriculum_validation_status']
          validation_timestamp: string | null
          validation_version: string | null
        }
        Insert: {
          category: string
          confidence_score?: number | null
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          extraction_method?: string | null
          grade_id?: string | null
          id?: string
          import_version?: string | null
          secondary_extraction_match?: boolean | null
          source_coordinates?: Json | null
          source_id?: string | null
          source_page?: string | null
          source_section?: string | null
          source_snippet?: string | null
          source_text_hash?: string | null
          subject_id: string
          term_id?: string | null
          text: string
          validation_confidence?: number | null
          validation_method?: string[] | null
          validation_reason?: string | null
          validation_status?: Database['public']['Enums']['curriculum_validation_status']
          validation_timestamp?: string | null
          validation_version?: string | null
        }
        Update: {
          category?: string
          confidence_score?: number | null
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          extraction_method?: string | null
          grade_id?: string | null
          id?: string
          import_version?: string | null
          secondary_extraction_match?: boolean | null
          source_coordinates?: Json | null
          source_id?: string | null
          source_page?: string | null
          source_section?: string | null
          source_snippet?: string | null
          source_text_hash?: string | null
          subject_id?: string
          term_id?: string | null
          text?: string
          validation_confidence?: number | null
          validation_method?: string[] | null
          validation_reason?: string | null
          validation_status?: Database['public']['Enums']['curriculum_validation_status']
          validation_timestamp?: string | null
          validation_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'assessment_notes_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_notes_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'curriculum_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_notes_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_notes_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'terms'
            referencedColumns: ['id']
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
            foreignKeyName: 'assessment_questions_assessment_id_fkey'
            columns: ['assessment_id']
            isOneToOne: false
            referencedRelation: 'assessments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_questions_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
        ]
      }
      assessments: {
        Row: {
          assessment_style: Database['public']['Enums']['assessment_style']
          created_at: string
          grade_id: string
          id: string
          is_demo_content: boolean
          language: Database['public']['Enums']['language_code']
          lesson_id: string | null
          subject_id: string
          term_id: string | null
          title: string
          topic_id: string | null
          type: Database['public']['Enums']['assessment_type']
        }
        Insert: {
          assessment_style?: Database['public']['Enums']['assessment_style']
          created_at?: string
          grade_id: string
          id?: string
          is_demo_content?: boolean
          language?: Database['public']['Enums']['language_code']
          lesson_id?: string | null
          subject_id: string
          term_id?: string | null
          title: string
          topic_id?: string | null
          type: Database['public']['Enums']['assessment_type']
        }
        Update: {
          assessment_style?: Database['public']['Enums']['assessment_style']
          created_at?: string
          grade_id?: string
          id?: string
          is_demo_content?: boolean
          language?: Database['public']['Enums']['language_code']
          lesson_id?: string | null
          subject_id?: string
          term_id?: string | null
          title?: string
          topic_id?: string | null
          type?: Database['public']['Enums']['assessment_type']
        }
        Relationships: [
          {
            foreignKeyName: 'assessments_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessments_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessments_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessments_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'terms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessments_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      atp_entries: {
        Row: {
          academic_year: string
          content_workflow_status: Database['public']['Enums']['content_workflow_status']
          created_at: string
          id: string
          sequence_order: number
          source_id: string | null
          term_id: string
          topic_id: string
          week_end: number | null
          week_start: number | null
        }
        Insert: {
          academic_year: string
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          id?: string
          sequence_order?: number
          source_id?: string | null
          term_id: string
          topic_id: string
          week_end?: number | null
          week_start?: number | null
        }
        Update: {
          academic_year?: string
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          id?: string
          sequence_order?: number
          source_id?: string | null
          term_id?: string
          topic_id?: string
          week_end?: number | null
          week_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'atp_entries_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'curriculum_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'atp_entries_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'terms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'atp_entries_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database['public']['Enums']['audit_actor_type']
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database['public']['Enums']['audit_actor_type']
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database['public']['Enums']['audit_actor_type']
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
      curriculum_outcomes: {
        Row: {
          code: string | null
          created_at: string
          description: string
          id: string
          phase_id: string | null
          sort_order: number
          source_id: string | null
          subject_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description: string
          id?: string
          phase_id?: string | null
          sort_order?: number
          source_id?: string | null
          subject_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string
          id?: string
          phase_id?: string | null
          sort_order?: number
          source_id?: string | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'curriculum_outcomes_phase_id_fkey'
            columns: ['phase_id']
            isOneToOne: false
            referencedRelation: 'phases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'curriculum_outcomes_source_fk'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'curriculum_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'curriculum_outcomes_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
        ]
      }
      curriculum_skills: {
        Row: {
          learning_objective_id: string | null
          skill_id: string
          topic_id: string | null
          weight: number
        }
        Insert: {
          learning_objective_id?: string | null
          skill_id: string
          topic_id?: string | null
          weight?: number
        }
        Update: {
          learning_objective_id?: string | null
          skill_id?: string
          topic_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: 'curriculum_skills_learning_objective_id_fkey'
            columns: ['learning_objective_id']
            isOneToOne: false
            referencedRelation: 'learning_objectives'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'curriculum_skills_skill_id_fkey'
            columns: ['skill_id']
            isOneToOne: false
            referencedRelation: 'skills'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'curriculum_skills_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      curriculum_sources: {
        Row: {
          academic_year: string | null
          checksum: string | null
          created_at: string
          document_id: string
          document_type: Database['public']['Enums']['source_document_type']
          grade_id: string | null
          id: string
          import_date: string | null
          last_verified: string | null
          local_file_path: string | null
          official_url: string | null
          organisation: string
          phase_id: string | null
          publication_year: number | null
          source_scope: string | null
          source_status: Database['public']['Enums']['curriculum_source_completeness']
          status: Database['public']['Enums']['source_verification_status']
          subject_id: string | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          academic_year?: string | null
          checksum?: string | null
          created_at?: string
          document_id: string
          document_type: Database['public']['Enums']['source_document_type']
          grade_id?: string | null
          id?: string
          import_date?: string | null
          last_verified?: string | null
          local_file_path?: string | null
          official_url?: string | null
          organisation?: string
          phase_id?: string | null
          publication_year?: number | null
          source_scope?: string | null
          source_status?: Database['public']['Enums']['curriculum_source_completeness']
          status?: Database['public']['Enums']['source_verification_status']
          subject_id?: string | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          academic_year?: string | null
          checksum?: string | null
          created_at?: string
          document_id?: string
          document_type?: Database['public']['Enums']['source_document_type']
          grade_id?: string | null
          id?: string
          import_date?: string | null
          last_verified?: string | null
          local_file_path?: string | null
          official_url?: string | null
          organisation?: string
          phase_id?: string | null
          publication_year?: number | null
          source_scope?: string | null
          source_status?: Database['public']['Enums']['curriculum_source_completeness']
          status?: Database['public']['Enums']['source_verification_status']
          subject_id?: string | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'curriculum_sources_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'curriculum_sources_phase_id_fkey'
            columns: ['phase_id']
            isOneToOne: false
            referencedRelation: 'phases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'curriculum_sources_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
        ]
      }
      curriculum_versions: {
        Row: {
          academic_year: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_current: boolean
          source_id: string | null
          supersedes_version_id: string | null
        }
        Insert: {
          academic_year: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_current?: boolean
          source_id?: string | null
          supersedes_version_id?: string | null
        }
        Update: {
          academic_year?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_current?: boolean
          source_id?: string | null
          supersedes_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'curriculum_versions_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'curriculum_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'curriculum_versions_supersedes_version_id_fkey'
            columns: ['supersedes_version_id']
            isOneToOne: false
            referencedRelation: 'curriculum_versions'
            referencedColumns: ['id']
          },
        ]
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
            foreignKeyName: 'exam_periods_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_periods_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_periods_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'terms'
            referencedColumns: ['id']
          },
        ]
      }
      exam_plans: {
        Row: {
          based_on_readiness_score: number | null
          created_at: string
          generated_at: string
          id: string
          is_active: boolean
          learner_id: string
          plan_items: Json
          recommended_session_minutes: number
          recommended_sessions_per_week: number
          subject_id: string
          term_id: string | null
        }
        Insert: {
          based_on_readiness_score?: number | null
          created_at?: string
          generated_at?: string
          id?: string
          is_active?: boolean
          learner_id: string
          plan_items?: Json
          recommended_session_minutes?: number
          recommended_sessions_per_week?: number
          subject_id: string
          term_id?: string | null
        }
        Update: {
          based_on_readiness_score?: number | null
          created_at?: string
          generated_at?: string
          id?: string
          is_active?: boolean
          learner_id?: string
          plan_items?: Json
          recommended_session_minutes?: number
          recommended_sessions_per_week?: number
          subject_id?: string
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'exam_plans_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_plans_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_plans_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'terms'
            referencedColumns: ['id']
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
            foreignKeyName: 'exam_readiness_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_readiness_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_readiness_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'terms'
            referencedColumns: ['id']
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
            foreignKeyName: 'grade_subjects_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grade_subjects_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
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
          name_af: string | null
          phase_id: string | null
        }
        Insert: {
          created_at?: string
          curriculum_id: string
          grade_number: number
          id?: string
          is_launched?: boolean
          name: string
          name_af?: string | null
          phase_id?: string | null
        }
        Update: {
          created_at?: string
          curriculum_id?: string
          grade_number?: number
          id?: string
          is_launched?: boolean
          name?: string
          name_af?: string | null
          phase_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'grades_curriculum_id_fkey'
            columns: ['curriculum_id']
            isOneToOne: false
            referencedRelation: 'curricula'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grades_phase_id_fkey'
            columns: ['phase_id']
            isOneToOne: false
            referencedRelation: 'phases'
            referencedColumns: ['id']
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
          status: Database['public']['Enums']['progress_status']
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          learner_id: string
          lesson_id: string
          score?: number | null
          started_at?: string | null
          status?: Database['public']['Enums']['progress_status']
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          learner_id?: string
          lesson_id?: string
          score?: number | null
          started_at?: string | null
          status?: Database['public']['Enums']['progress_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learner_progress_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learner_progress_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
        ]
      }
      learner_skill_mastery: {
        Row: {
          attempts_count: number
          id: string
          learner_id: string
          mastery_score: number
          skill_id: string
          subject_id: string | null
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          attempts_count?: number
          id?: string
          learner_id: string
          mastery_score?: number
          skill_id: string
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts_count?: number
          id?: string
          learner_id?: string
          mastery_score?: number
          skill_id?: string
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learner_skill_mastery_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learner_skill_mastery_skill_id_fkey'
            columns: ['skill_id']
            isOneToOne: false
            referencedRelation: 'skills'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learner_skill_mastery_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learner_skill_mastery_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      learners: {
        Row: {
          avatar: Database['public']['Enums']['learner_avatar']
          birth_year: number | null
          created_at: string
          curriculum_id: string
          display_name: string
          grade_id: string
          id: string
          parent_id: string
          preferred_language: Database['public']['Enums']['language_code']
          updated_at: string
        }
        Insert: {
          avatar?: Database['public']['Enums']['learner_avatar']
          birth_year?: number | null
          created_at?: string
          curriculum_id: string
          display_name: string
          grade_id: string
          id?: string
          parent_id: string
          preferred_language?: Database['public']['Enums']['language_code']
          updated_at?: string
        }
        Update: {
          avatar?: Database['public']['Enums']['learner_avatar']
          birth_year?: number | null
          created_at?: string
          curriculum_id?: string
          display_name?: string
          grade_id?: string
          id?: string
          parent_id?: string
          preferred_language?: Database['public']['Enums']['language_code']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learners_curriculum_id_fkey'
            columns: ['curriculum_id']
            isOneToOne: false
            referencedRelation: 'curricula'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learners_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learners_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'parents'
            referencedColumns: ['id']
          },
        ]
      }
      learning_objectives: {
        Row: {
          content_workflow_status: Database['public']['Enums']['content_workflow_status']
          created_at: string
          description: string
          id: string
          language: Database['public']['Enums']['language_code']
          sort_order: number
          source_id: string | null
          source_page: string | null
          source_section: string | null
          subtopic_id: string | null
          topic_id: string
        }
        Insert: {
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          description: string
          id?: string
          language?: Database['public']['Enums']['language_code']
          sort_order?: number
          source_id?: string | null
          source_page?: string | null
          source_section?: string | null
          subtopic_id?: string | null
          topic_id: string
        }
        Update: {
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          description?: string
          id?: string
          language?: Database['public']['Enums']['language_code']
          sort_order?: number
          source_id?: string | null
          source_page?: string | null
          source_section?: string | null
          subtopic_id?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learning_objectives_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'curriculum_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_objectives_subtopic_id_fkey'
            columns: ['subtopic_id']
            isOneToOne: false
            referencedRelation: 'subtopics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_objectives_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      lesson_content: {
        Row: {
          body_markdown: string | null
          created_at: string
          heading: string | null
          id: string
          language: Database['public']['Enums']['language_code']
          lesson_id: string
          section_type: Database['public']['Enums']['lesson_section_type']
          sort_order: number
          translation_status: Database['public']['Enums']['translation_status']
        }
        Insert: {
          body_markdown?: string | null
          created_at?: string
          heading?: string | null
          id?: string
          language?: Database['public']['Enums']['language_code']
          lesson_id: string
          section_type: Database['public']['Enums']['lesson_section_type']
          sort_order?: number
          translation_status?: Database['public']['Enums']['translation_status']
        }
        Update: {
          body_markdown?: string | null
          created_at?: string
          heading?: string | null
          id?: string
          language?: Database['public']['Enums']['language_code']
          lesson_id?: string
          section_type?: Database['public']['Enums']['lesson_section_type']
          sort_order?: number
          translation_status?: Database['public']['Enums']['translation_status']
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_content_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
        ]
      }
      lessons: {
        Row: {
          afrikaans_narration_script: string | null
          afrikaans_practice_questions: Json | null
          afrikaans_visual_storyboard: Json | null
          afrikaans_worked_example: Json | null
          content_workflow_status: Database['public']['Enums']['content_workflow_status']
          created_at: string
          estimated_minutes: number
          id: string
          is_demo_content: boolean
          language: Database['public']['Enums']['language_code']
          narration_script: string | null
          practice_questions: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          sort_order: number
          source_trace: Json | null
          subtopic_id: string | null
          title: string
          topic_id: string
          translation_status: Database['public']['Enums']['translation_status']
          visual_storyboard: Json | null
          worked_example: Json | null
        }
        Insert: {
          afrikaans_narration_script?: string | null
          afrikaans_practice_questions?: Json | null
          afrikaans_visual_storyboard?: Json | null
          afrikaans_worked_example?: Json | null
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          estimated_minutes?: number
          id?: string
          is_demo_content?: boolean
          language?: Database['public']['Enums']['language_code']
          narration_script?: string | null
          practice_questions?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          sort_order?: number
          source_trace?: Json | null
          subtopic_id?: string | null
          title: string
          topic_id: string
          translation_status?: Database['public']['Enums']['translation_status']
          visual_storyboard?: Json | null
          worked_example?: Json | null
        }
        Update: {
          afrikaans_narration_script?: string | null
          afrikaans_practice_questions?: Json | null
          afrikaans_visual_storyboard?: Json | null
          afrikaans_worked_example?: Json | null
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          estimated_minutes?: number
          id?: string
          is_demo_content?: boolean
          language?: Database['public']['Enums']['language_code']
          narration_script?: string | null
          practice_questions?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          sort_order?: number
          source_trace?: Json | null
          subtopic_id?: string | null
          title?: string
          topic_id?: string
          translation_status?: Database['public']['Enums']['translation_status']
          visual_storyboard?: Json | null
          worked_example?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'lessons_subtopic_id_fkey'
            columns: ['subtopic_id']
            isOneToOne: false
            referencedRelation: 'subtopics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lessons_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
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
            foreignKeyName: 'mastery_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mastery_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
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
            foreignKeyName: 'mastery_weakness_signals_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mastery_weakness_signals_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      media: {
        Row: {
          age_rating: string
          approval_status: Database['public']['Enums']['media_approval_status']
          created_at: string
          duration_seconds: number | null
          embed_url: string | null
          grade_id: string | null
          id: string
          language: Database['public']['Enums']['language_code']
          lesson_id: string | null
          license_status: string | null
          media_type: Database['public']['Enums']['media_type']
          provider: string
          source: string | null
          subject_id: string | null
          topic_id: string | null
          url: string | null
        }
        Insert: {
          age_rating?: string
          approval_status?: Database['public']['Enums']['media_approval_status']
          created_at?: string
          duration_seconds?: number | null
          embed_url?: string | null
          grade_id?: string | null
          id?: string
          language?: Database['public']['Enums']['language_code']
          lesson_id?: string | null
          license_status?: string | null
          media_type: Database['public']['Enums']['media_type']
          provider?: string
          source?: string | null
          subject_id?: string | null
          topic_id?: string | null
          url?: string | null
        }
        Update: {
          age_rating?: string
          approval_status?: Database['public']['Enums']['media_approval_status']
          created_at?: string
          duration_seconds?: number | null
          embed_url?: string | null
          grade_id?: string | null
          id?: string
          language?: Database['public']['Enums']['language_code']
          lesson_id?: string | null
          license_status?: string | null
          media_type?: Database['public']['Enums']['media_type']
          provider?: string
          source?: string | null
          subject_id?: string | null
          topic_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'media_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      moderation_logs: {
        Row: {
          content_type: Database['public']['Enums']['moderation_content_type']
          created_at: string
          decision: Database['public']['Enums']['moderation_decision']
          id: string
          learner_id: string | null
          parent_id: string | null
          provider: string
          reasons: Json
          visual_safety_checked: boolean
        }
        Insert: {
          content_type: Database['public']['Enums']['moderation_content_type']
          created_at?: string
          decision?: Database['public']['Enums']['moderation_decision']
          id?: string
          learner_id?: string | null
          parent_id?: string | null
          provider?: string
          reasons?: Json
          visual_safety_checked?: boolean
        }
        Update: {
          content_type?: Database['public']['Enums']['moderation_content_type']
          created_at?: string
          decision?: Database['public']['Enums']['moderation_decision']
          id?: string
          learner_id?: string | null
          parent_id?: string | null
          provider?: string
          reasons?: Json
          visual_safety_checked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'moderation_logs_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'moderation_logs_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'parents'
            referencedColumns: ['id']
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
          preferred_language: Database['public']['Enums']['language_code']
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          preferred_language?: Database['public']['Enums']['language_code']
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          preferred_language?: Database['public']['Enums']['language_code']
          updated_at?: string
        }
        Relationships: []
      }
      phases: {
        Row: {
          code: string
          created_at: string
          curriculum_id: string
          grade_range_end: number
          grade_range_start: number
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          curriculum_id: string
          grade_range_end: number
          grade_range_start: number
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          curriculum_id?: string
          grade_range_end?: number
          grade_range_start?: number
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'phases_curriculum_id_fkey'
            columns: ['curriculum_id']
            isOneToOne: false
            referencedRelation: 'curricula'
            referencedColumns: ['id']
          },
        ]
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
            foreignKeyName: 'question_options_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
        ]
      }
      question_skills: {
        Row: {
          question_id: string
          skill_id: string
          weight: number
        }
        Insert: {
          question_id: string
          skill_id: string
          weight?: number
        }
        Update: {
          question_id?: string
          skill_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: 'question_skills_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'question_skills_skill_id_fkey'
            columns: ['skill_id']
            isOneToOne: false
            referencedRelation: 'skills'
            referencedColumns: ['id']
          },
        ]
      }
      questions: {
        Row: {
          assessment_style: Database['public']['Enums']['assessment_style']
          content_workflow_status: Database['public']['Enums']['content_workflow_status']
          correct_answer: string
          created_at: string
          difficulty: Database['public']['Enums']['question_difficulty']
          explanation: string | null
          grade_id: string
          id: string
          is_demo_content: boolean
          language: Database['public']['Enums']['language_code']
          learning_objective_id: string | null
          prompt: string
          question_type: Database['public']['Enums']['question_type']
          source_id: string | null
          subject_id: string
          subtopic_id: string | null
          term_id: string | null
          topic_id: string
          translation_status: Database['public']['Enums']['translation_status']
        }
        Insert: {
          assessment_style?: Database['public']['Enums']['assessment_style']
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          correct_answer: string
          created_at?: string
          difficulty?: Database['public']['Enums']['question_difficulty']
          explanation?: string | null
          grade_id: string
          id?: string
          is_demo_content?: boolean
          language?: Database['public']['Enums']['language_code']
          learning_objective_id?: string | null
          prompt: string
          question_type?: Database['public']['Enums']['question_type']
          source_id?: string | null
          subject_id: string
          subtopic_id?: string | null
          term_id?: string | null
          topic_id: string
          translation_status?: Database['public']['Enums']['translation_status']
        }
        Update: {
          assessment_style?: Database['public']['Enums']['assessment_style']
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          correct_answer?: string
          created_at?: string
          difficulty?: Database['public']['Enums']['question_difficulty']
          explanation?: string | null
          grade_id?: string
          id?: string
          is_demo_content?: boolean
          language?: Database['public']['Enums']['language_code']
          learning_objective_id?: string | null
          prompt?: string
          question_type?: Database['public']['Enums']['question_type']
          source_id?: string | null
          subject_id?: string
          subtopic_id?: string | null
          term_id?: string | null
          topic_id?: string
          translation_status?: Database['public']['Enums']['translation_status']
        }
        Relationships: [
          {
            foreignKeyName: 'questions_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_learning_objective_id_fkey'
            columns: ['learning_objective_id']
            isOneToOne: false
            referencedRelation: 'learning_objectives'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'curriculum_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_subtopic_id_fkey'
            columns: ['subtopic_id']
            isOneToOne: false
            referencedRelation: 'subtopics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'terms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      skills: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      strands: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          phase_id: string | null
          sort_order: number
          subject_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          phase_id?: string | null
          sort_order?: number
          subject_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          phase_id?: string | null
          sort_order?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'strands_phase_id_fkey'
            columns: ['phase_id']
            isOneToOne: false
            referencedRelation: 'phases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'strands_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
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
            foreignKeyName: 'study_sessions_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'study_sessions_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'study_sessions_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'study_sessions_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      subject_components: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          name_af: string | null
          sort_order: number
          subject_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          name_af?: string | null
          sort_order?: number
          subject_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          name_af?: string | null
          sort_order?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subject_components_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
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
          name_af: string | null
        }
        Insert: {
          code: string
          color_key?: string | null
          created_at?: string
          curriculum_id: string
          icon_key?: string | null
          id?: string
          name: string
          name_af?: string | null
        }
        Update: {
          code?: string
          color_key?: string | null
          created_at?: string
          curriculum_id?: string
          icon_key?: string | null
          id?: string
          name?: string
          name_af?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'subjects_curriculum_id_fkey'
            columns: ['curriculum_id']
            isOneToOne: false
            referencedRelation: 'curricula'
            referencedColumns: ['id']
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_interval: Database['public']['Enums']['billing_interval']
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
          billing_interval: Database['public']['Enums']['billing_interval']
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
          billing_interval?: Database['public']['Enums']['billing_interval']
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
          status: Database['public']['Enums']['subscription_status']
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
          status?: Database['public']['Enums']['subscription_status']
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
          status?: Database['public']['Enums']['subscription_status']
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'parents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'subscription_plans'
            referencedColumns: ['id']
          },
        ]
      }
      subtopics: {
        Row: {
          content_workflow_status: Database['public']['Enums']['content_workflow_status']
          created_at: string
          description: string | null
          id: string
          name: string
          name_af: string | null
          sort_order: number
          topic_id: string
        }
        Insert: {
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          description?: string | null
          id?: string
          name: string
          name_af?: string | null
          sort_order?: number
          topic_id: string
        }
        Update: {
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          name_af?: string | null
          sort_order?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subtopics_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      terminology: {
        Row: {
          created_at: string
          definition: string | null
          grade_id: string | null
          id: string
          language: Database['public']['Enums']['language_code']
          reviewer_id: string | null
          source_id: string | null
          subject_id: string | null
          term: string
          translation: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          definition?: string | null
          grade_id?: string | null
          id?: string
          language: Database['public']['Enums']['language_code']
          reviewer_id?: string | null
          source_id?: string | null
          subject_id?: string | null
          term: string
          translation?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          definition?: string | null
          grade_id?: string | null
          id?: string
          language?: Database['public']['Enums']['language_code']
          reviewer_id?: string | null
          source_id?: string | null
          subject_id?: string | null
          term?: string
          translation?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'terminology_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'terminology_reviewer_id_fkey'
            columns: ['reviewer_id']
            isOneToOne: false
            referencedRelation: 'admins'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'terminology_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'curriculum_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'terminology_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          grade_id: string
          id: string
          name: string
          name_af: string | null
          term_number: number
        }
        Insert: {
          created_at?: string
          grade_id: string
          id?: string
          name: string
          name_af?: string | null
          term_number: number
        }
        Update: {
          created_at?: string
          grade_id?: string
          id?: string
          name?: string
          name_af?: string | null
          term_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'terms_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
        ]
      }
      topics: {
        Row: {
          code: string
          confidence_score: number | null
          content_workflow_status: Database['public']['Enums']['content_workflow_status']
          created_at: string
          description: string | null
          extraction_method: string | null
          grade_id: string
          id: string
          import_version: string | null
          is_demo_content: boolean
          name: string
          name_af: string | null
          secondary_extraction_match: boolean | null
          sort_order: number
          source_coordinates: Json | null
          source_id: string | null
          source_page: string | null
          source_section: string | null
          source_snippet: string | null
          source_text_hash: string | null
          strand_id: string | null
          subject_component_id: string | null
          subject_id: string
          term_id: string | null
          validation_confidence: number | null
          validation_method: string[] | null
          validation_reason: string | null
          validation_status: Database['public']['Enums']['curriculum_validation_status']
          validation_timestamp: string | null
          validation_version: string | null
        }
        Insert: {
          code: string
          confidence_score?: number | null
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          description?: string | null
          extraction_method?: string | null
          grade_id: string
          id?: string
          import_version?: string | null
          is_demo_content?: boolean
          name: string
          name_af?: string | null
          secondary_extraction_match?: boolean | null
          sort_order?: number
          source_coordinates?: Json | null
          source_id?: string | null
          source_page?: string | null
          source_section?: string | null
          source_snippet?: string | null
          source_text_hash?: string | null
          strand_id?: string | null
          subject_component_id?: string | null
          subject_id: string
          term_id?: string | null
          validation_confidence?: number | null
          validation_method?: string[] | null
          validation_reason?: string | null
          validation_status?: Database['public']['Enums']['curriculum_validation_status']
          validation_timestamp?: string | null
          validation_version?: string | null
        }
        Update: {
          code?: string
          confidence_score?: number | null
          content_workflow_status?: Database['public']['Enums']['content_workflow_status']
          created_at?: string
          description?: string | null
          extraction_method?: string | null
          grade_id?: string
          id?: string
          import_version?: string | null
          is_demo_content?: boolean
          name?: string
          name_af?: string | null
          secondary_extraction_match?: boolean | null
          sort_order?: number
          source_coordinates?: Json | null
          source_id?: string | null
          source_page?: string | null
          source_section?: string | null
          source_snippet?: string | null
          source_text_hash?: string | null
          strand_id?: string | null
          subject_component_id?: string | null
          subject_id?: string
          term_id?: string | null
          validation_confidence?: number | null
          validation_method?: string[] | null
          validation_reason?: string | null
          validation_status?: Database['public']['Enums']['curriculum_validation_status']
          validation_timestamp?: string | null
          validation_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'topics_grade_id_fkey'
            columns: ['grade_id']
            isOneToOne: false
            referencedRelation: 'grades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topics_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'curriculum_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topics_strand_id_fkey'
            columns: ['strand_id']
            isOneToOne: false
            referencedRelation: 'strands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topics_subject_component_id_fkey'
            columns: ['subject_component_id']
            isOneToOne: false
            referencedRelation: 'subject_components'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topics_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topics_term_id_fkey'
            columns: ['term_id']
            isOneToOne: false
            referencedRelation: 'terms'
            referencedColumns: ['id']
          },
        ]
      }
      tutor_explanations: {
        Row: {
          created_at: string
          explanation: Json
          framing: string
          id: string
          input_tokens: number
          learner_id: string
          model: string
          output_tokens: number
          topic_id: string
        }
        Insert: {
          created_at?: string
          explanation: Json
          framing: string
          id?: string
          input_tokens: number
          learner_id: string
          model: string
          output_tokens: number
          topic_id: string
        }
        Update: {
          created_at?: string
          explanation?: Json
          framing?: string
          id?: string
          input_tokens?: number
          learner_id?: string
          model?: string
          output_tokens?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tutor_explanations_learner_id_fkey'
            columns: ['learner_id']
            isOneToOne: false
            referencedRelation: 'learners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tutor_explanations_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      admin_role: 'content_admin' | 'super_admin'
      assessment_style: 'caps_standard' | 'ieb_enrichment'
      assessment_type: 'mini_quiz' | 'quiz' | 'test' | 'mock_exam'
      audit_actor_type: 'parent' | 'admin' | 'system'
      billing_interval: 'monthly' | 'annual'
      content_workflow_status:
        | 'DRAFT'
        | 'AI_GENERATED'
        | 'REVIEW_REQUIRED'
        | 'VERIFIED'
        | 'PUBLISHED'
        | 'ARCHIVED'
      curriculum_source_completeness:
        'COMPLETE' | 'INCOMPLETE' | 'AMENDMENT_ONLY' | 'UNKNOWN'
      curriculum_validation_status:
        | 'NOT_VALIDATED'
        | 'AUTO_VALIDATED'
        | 'AUTO_VERIFIED'
        | 'REVIEW_REQUIRED'
        | 'SOURCE_INCOMPLETE'
        | 'NON_CURRICULUM'
        | 'CONFLICTING'
      language_code:
        'en' | 'af' | 'zu' | 'xh' | 'nr' | 'nso' | 'st' | 'tn' | 'ss' | 've' | 'ts'
      learner_avatar:
        'fox' | 'owl' | 'lion' | 'elephant' | 'zebra' | 'meerkat' | 'tortoise' | 'eagle'
      lesson_section_type:
        | 'what_are_we_learning'
        | 'simple_explanation'
        | 'visual_explanation'
        | 'example'
        | 'try_it_yourself'
        | 'practice_questions'
        | 'mini_quiz'
        | 'what_did_you_learn'
        | 'mastery_result'
        | 'next_step'
      media_approval_status: 'pending' | 'approved' | 'rejected'
      media_type:
        | 'svg_animation'
        | 'interactive_demo'
        | 'own_video'
        | 'external_video'
        | 'youtube_embed'
        | 'audio_narration'
        | 'image'
        | 'diagram'
      moderation_content_type: 'image' | 'pdf' | 'text'
      moderation_decision: 'approved' | 'rejected' | 'pending'
      progress_status: 'not_started' | 'in_progress' | 'completed'
      question_difficulty: 'easy' | 'medium' | 'hard'
      question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'numeric'
      source_document_type:
        'caps' | 'atp' | 'sba_exemplar' | 'ieb_reference' | 'index_page' | 'other'
      source_verification_status:
        | 'PENDING'
        | 'IMPORTED'
        | 'PARSED'
        | 'REVIEW_REQUIRED'
        | 'VERIFIED'
        | 'PUBLISHED'
        | 'ARCHIVED'
      subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
      translation_status:
        'original' | 'machine_translated' | 'ai_reviewed' | 'human_reviewed' | 'verified'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ['content_admin', 'super_admin'],
      assessment_style: ['caps_standard', 'ieb_enrichment'],
      assessment_type: ['mini_quiz', 'quiz', 'test', 'mock_exam'],
      audit_actor_type: ['parent', 'admin', 'system'],
      billing_interval: ['monthly', 'annual'],
      content_workflow_status: [
        'DRAFT',
        'AI_GENERATED',
        'REVIEW_REQUIRED',
        'VERIFIED',
        'PUBLISHED',
        'ARCHIVED',
      ],
      curriculum_source_completeness: [
        'COMPLETE',
        'INCOMPLETE',
        'AMENDMENT_ONLY',
        'UNKNOWN',
      ],
      curriculum_validation_status: [
        'NOT_VALIDATED',
        'AUTO_VALIDATED',
        'AUTO_VERIFIED',
        'REVIEW_REQUIRED',
        'SOURCE_INCOMPLETE',
        'NON_CURRICULUM',
        'CONFLICTING',
      ],
      language_code: ['en', 'af', 'zu', 'xh', 'nr', 'nso', 'st', 'tn', 'ss', 've', 'ts'],
      learner_avatar: [
        'fox',
        'owl',
        'lion',
        'elephant',
        'zebra',
        'meerkat',
        'tortoise',
        'eagle',
      ],
      lesson_section_type: [
        'what_are_we_learning',
        'simple_explanation',
        'visual_explanation',
        'example',
        'try_it_yourself',
        'practice_questions',
        'mini_quiz',
        'what_did_you_learn',
        'mastery_result',
        'next_step',
      ],
      media_approval_status: ['pending', 'approved', 'rejected'],
      media_type: [
        'svg_animation',
        'interactive_demo',
        'own_video',
        'external_video',
        'youtube_embed',
        'audio_narration',
        'image',
        'diagram',
      ],
      moderation_content_type: ['image', 'pdf', 'text'],
      moderation_decision: ['approved', 'rejected', 'pending'],
      progress_status: ['not_started', 'in_progress', 'completed'],
      question_difficulty: ['easy', 'medium', 'hard'],
      question_type: ['multiple_choice', 'true_false', 'short_answer', 'numeric'],
      source_document_type: [
        'caps',
        'atp',
        'sba_exemplar',
        'ieb_reference',
        'index_page',
        'other',
      ],
      source_verification_status: [
        'PENDING',
        'IMPORTED',
        'PARSED',
        'REVIEW_REQUIRED',
        'VERIFIED',
        'PUBLISHED',
        'ARCHIVED',
      ],
      subscription_status: ['trialing', 'active', 'past_due', 'canceled', 'incomplete'],
      translation_status: [
        'original',
        'machine_translated',
        'ai_reviewed',
        'human_reviewed',
        'verified',
      ],
    },
  },
} as const
