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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          category: string
          created_at: string
          created_by: string
          decline_reason: string | null
          description: string | null
          end_time: string
          id: string
          notes: string | null
          responded_at: string | null
          start_time: string
          status: string
          store_id: string
          target_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          category?: string
          created_at?: string
          created_by: string
          decline_reason?: string | null
          description?: string | null
          end_time: string
          id?: string
          notes?: string | null
          responded_at?: string | null
          start_time: string
          status?: string
          store_id: string
          target_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          category?: string
          created_at?: string
          created_by?: string
          decline_reason?: string | null
          description?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          responded_at?: string | null
          start_time?: string
          status?: string
          store_id?: string
          target_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          store_id: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          store_id?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          store_id?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      employee_availability: {
        Row: {
          availability_type: Database["public"]["Enums"]["availability_type"]
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          store_id: string
          user_id: string
        }
        Insert: {
          availability_type?: Database["public"]["Enums"]["availability_type"]
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          store_id: string
          user_id: string
        }
        Update: {
          availability_type?: Database["public"]["Enums"]["availability_type"]
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_availability_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_constraints: {
        Row: {
          created_at: string
          custom_days_off: number | null
          custom_max_daily_hours: number | null
          custom_max_split_shifts: number | null
          custom_max_weekly_hours: number | null
          id: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_days_off?: number | null
          custom_max_daily_hours?: number | null
          custom_max_split_shifts?: number | null
          custom_max_weekly_hours?: number | null
          id?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_days_off?: number | null
          custom_max_daily_hours?: number | null
          custom_max_split_shifts?: number | null
          custom_max_weekly_hours?: number | null
          id?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_constraints_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_constraints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_details: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["department"]
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
          weekly_contract_hours: number
        }
        Insert: {
          created_at?: string
          department: Database["public"]["Enums"]["department"]
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
          weekly_contract_hours?: number
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["department"]
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
          weekly_contract_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          exception_type: Database["public"]["Enums"]["exception_type"]
          id: string
          notes: string | null
          start_date: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          exception_type: Database["public"]["Enums"]["exception_type"]
          id?: string
          notes?: string | null
          start_date: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          exception_type?: Database["public"]["Enums"]["exception_type"]
          id?: string
          notes?: string | null
          start_date?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_exceptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_exceptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_monthly_stats: {
        Row: {
          created_at: string
          days_off_count: number
          id: string
          month: number
          split_shifts_count: number
          store_id: string
          total_hours: number
          updated_at: string
          user_id: string
          weekend_shifts_count: number
          year: number
        }
        Insert: {
          created_at?: string
          days_off_count?: number
          id?: string
          month: number
          split_shifts_count?: number
          store_id: string
          total_hours?: number
          updated_at?: string
          user_id: string
          weekend_shifts_count?: number
          year: number
        }
        Update: {
          created_at?: string
          days_off_count?: number
          id?: string
          month?: number
          split_shifts_count?: number
          store_id?: string
          total_hours?: number
          updated_at?: string
          user_id?: string
          weekend_shifts_count?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_monthly_stats_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_monthly_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_stats: {
        Row: {
          created_at: string
          current_balance: number
          id: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          id?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          id?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_stats_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_adjustments: {
        Row: {
          adjustment_type: string
          created_at: string
          extra_hours: number
          id: string
          notes: string | null
          source_suggestion_id: string | null
          store_id: string
          user_id: string
          week_start: string
        }
        Insert: {
          adjustment_type: string
          created_at?: string
          extra_hours?: number
          id?: string
          notes?: string | null
          source_suggestion_id?: string | null
          store_id: string
          user_id: string
          week_start: string
        }
        Update: {
          adjustment_type?: string
          created_at?: string
          extra_hours?: number
          id?: string
          notes?: string | null
          source_suggestion_id?: string | null
          store_id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_adjustments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_runs: {
        Row: {
          accepted_gaps: Json | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["department"]
          error_message: string | null
          fitness_score: number | null
          hour_adjustments: Json | null
          id: string
          iterations_run: number | null
          notes: string | null
          status: string
          store_id: string
          suggestions: Json | null
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          accepted_gaps?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department: Database["public"]["Enums"]["department"]
          error_message?: string | null
          fitness_score?: number | null
          hour_adjustments?: Json | null
          id?: string
          iterations_run?: number | null
          notes?: string | null
          status?: string
          store_id: string
          suggestions?: Json | null
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          accepted_gaps?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department"]
          error_message?: string | null
          fitness_score?: number | null
          hour_adjustments?: Json | null
          id?: string
          iterations_run?: number | null
          notes?: string | null
          status?: string
          store_id?: string
          suggestions?: Json | null
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          department: Database["public"]["Enums"]["department"] | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          store_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["department"] | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          store_id?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["department"] | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          store_id?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      lending_request_messages: {
        Row: {
          id: string
          lending_request_id: string
          message: string
          sender_user_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          lending_request_id: string
          message: string
          sender_user_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          lending_request_id?: string
          message?: string
          sender_user_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lending_request_messages_lending_request_id_fkey"
            columns: ["lending_request_id"]
            isOneToOne: false
            referencedRelation: "lending_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lending_request_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lending_requests: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          last_modified_at: string
          last_modified_by: string | null
          proposer_store_id: string
          proposer_user_id: string
          reason: string | null
          receiver_store_id: string
          start_time: string | null
          status: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          last_modified_at?: string
          last_modified_by?: string | null
          proposer_store_id: string
          proposer_user_id: string
          reason?: string | null
          receiver_store_id: string
          start_time?: string | null
          status?: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          last_modified_at?: string
          last_modified_by?: string | null
          proposer_store_id?: string
          proposer_user_id?: string
          reason?: string | null
          receiver_store_id?: string
          start_time?: string | null
          status?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lending_requests_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lending_requests_proposer_store_id_fkey"
            columns: ["proposer_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lending_requests_proposer_user_id_fkey"
            columns: ["proposer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lending_requests_receiver_store_id_fkey"
            columns: ["receiver_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lending_requests_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lending_suggestions: {
        Row: {
          created_at: string
          department: string
          generation_run_id: string
          id: string
          reason: string | null
          source_approved: boolean | null
          source_approved_at: string | null
          source_approved_by: string | null
          source_store_id: string
          status: string
          suggested_date: string
          suggested_end_time: string
          suggested_start_time: string
          target_approved: boolean | null
          target_approved_at: string | null
          target_approved_by: string | null
          target_store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          generation_run_id: string
          id?: string
          reason?: string | null
          source_approved?: boolean | null
          source_approved_at?: string | null
          source_approved_by?: string | null
          source_store_id: string
          status?: string
          suggested_date: string
          suggested_end_time: string
          suggested_start_time: string
          target_approved?: boolean | null
          target_approved_at?: string | null
          target_approved_by?: string | null
          target_store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          generation_run_id?: string
          id?: string
          reason?: string | null
          source_approved?: boolean | null
          source_approved_at?: string | null
          source_approved_by?: string | null
          source_store_id?: string
          status?: string
          suggested_date?: string
          suggested_end_time?: string
          suggested_start_time?: string
          target_approved?: boolean | null
          target_approved_at?: string | null
          target_approved_by?: string | null
          target_store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lending_suggestions_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "generation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lending_suggestions_source_store_id_fkey"
            columns: ["source_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lending_suggestions_target_store_id_fkey"
            columns: ["target_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lending_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          store_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          store_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          store_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          vacation_balance: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          vacation_balance?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          vacation_balance?: number
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          date: string
          department: Database["public"]["Enums"]["department"]
          end_time: string | null
          generation_run_id: string | null
          id: string
          is_day_off: boolean
          start_time: string | null
          status: Database["public"]["Enums"]["shift_status"]
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          department: Database["public"]["Enums"]["department"]
          end_time?: string | null
          generation_run_id?: string | null
          id?: string
          is_day_off?: boolean
          start_time?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          department?: Database["public"]["Enums"]["department"]
          end_time?: string | null
          generation_run_id?: string | null
          id?: string
          is_day_off?: boolean
          start_time?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "generation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_coverage_requirements: {
        Row: {
          created_at: string
          day_of_week: number
          department: Database["public"]["Enums"]["department"]
          hour_slot: string
          id: string
          min_staff_required: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          department: Database["public"]["Enums"]["department"]
          hour_slot: string
          id?: string
          min_staff_required?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          department?: Database["public"]["Enums"]["department"]
          hour_slot?: string
          id?: string
          min_staff_required?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_coverage_requirements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_opening_hours: {
        Row: {
          closing_time: string
          created_at: string
          day_of_week: number
          id: string
          opening_time: string
          store_id: string
          updated_at: string
        }
        Insert: {
          closing_time: string
          created_at?: string
          day_of_week: number
          id?: string
          opening_time: string
          store_id: string
          updated_at?: string
        }
        Update: {
          closing_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          opening_time?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_opening_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_rules: {
        Row: {
          created_at: string
          generation_enabled: boolean
          mandatory_days_off_per_week: number
          max_daily_hours_per_employee: number
          max_daily_team_hours: number
          max_daily_team_hours_cucina: number
          max_daily_team_hours_sala: number
          max_split_shifts_per_employee: number
          max_split_shifts_per_employee_per_week: number
          max_team_hours_cucina_per_week: number
          max_team_hours_sala_per_week: number
          max_weekly_hours_per_employee: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          generation_enabled?: boolean
          mandatory_days_off_per_week?: number
          max_daily_hours_per_employee?: number
          max_daily_team_hours?: number
          max_daily_team_hours_cucina?: number
          max_daily_team_hours_sala?: number
          max_split_shifts_per_employee?: number
          max_split_shifts_per_employee_per_week?: number
          max_team_hours_cucina_per_week?: number
          max_team_hours_sala_per_week?: number
          max_weekly_hours_per_employee?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          generation_enabled?: boolean
          mandatory_days_off_per_week?: number
          max_daily_hours_per_employee?: number
          max_daily_team_hours?: number
          max_daily_team_hours_cucina?: number
          max_daily_team_hours_sala?: number
          max_split_shifts_per_employee?: number
          max_split_shifts_per_employee_per_week?: number
          max_team_hours_cucina_per_week?: number
          max_team_hours_sala_per_week?: number
          max_weekly_hours_per_employee?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shift_allowed_times: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["department"]
          hour: number
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["shift_time_kind"]
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: Database["public"]["Enums"]["department"]
          hour: number
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["shift_time_kind"]
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["department"]
          hour?: number
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["shift_time_kind"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_shift_allowed_times_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shift_templates: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["department"]
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: Database["public"]["Enums"]["department"]
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["department"]
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_shift_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suggestion_outcomes: {
        Row: {
          action_type: string | null
          created_at: string
          day_of_week: number
          department: string
          hour_slot: number
          id: string
          outcome: string
          store_id: string
          suggestion_id: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          day_of_week: number
          department: string
          hour_slot: number
          id?: string
          outcome: string
          store_id: string
          suggestion_id?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          action_type?: string | null
          created_at?: string
          day_of_week?: number
          department?: string
          hour_slot?: number
          id?: string
          outcome?: string
          store_id?: string
          suggestion_id?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_outcomes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_outcomes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_requests: {
        Row: {
          created_at: string
          department: string
          id: string
          notes: string | null
          request_date: string
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          selected_hour: number | null
          status: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          notes?: string | null
          request_date: string
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_hour?: number | null
          status?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          notes?: string | null
          request_date?: string
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_hour?: number | null
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_store_assignments: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_store_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_store_member: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "employee"
      availability_type: "available" | "unavailable"
      department: "sala" | "cucina"
      exception_type:
        | "ferie"
        | "permesso"
        | "malattia"
        | "modifica_orario"
        | "altro"
      shift_status: "draft" | "published" | "archived"
      shift_time_kind: "entry" | "exit"
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
      app_role: ["super_admin", "admin", "employee"],
      availability_type: ["available", "unavailable"],
      department: ["sala", "cucina"],
      exception_type: [
        "ferie",
        "permesso",
        "malattia",
        "modifica_orario",
        "altro",
      ],
      shift_status: ["draft", "published", "archived"],
      shift_time_kind: ["entry", "exit"],
    },
  },
} as const
