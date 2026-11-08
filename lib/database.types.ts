/**
 * Database types for the `public` schema.
 *
 * Written to match supabase/migrations in the same format that
 * `npx supabase gen types typescript --linked > lib/database.types.ts`
 * produces. After changing the schema, regenerate this file with that command
 * (or update it by hand) so queries stay type-checked.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      school_years: {
        Row: {
          id: number;
          label: string;
          starts_on: string | null;
          ends_on: string | null;
          is_current: boolean;
          registration_open: boolean;
          default_amount_due: number | null;
        } & Timestamps;
        Insert: {
          label: string;
          starts_on?: string | null;
          ends_on?: string | null;
          is_current?: boolean;
          registration_open?: boolean;
          default_amount_due?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["school_years"]["Insert"]>;
        Relationships: [];
      };
      households: {
        Row: {
          id: number;
          display_name: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relationship: string | null;
        } & Timestamps;
        Insert: {
          display_name: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["households"]["Insert"]>;
        Relationships: [];
      };
      parents: {
        Row: {
          id: number;
          household_id: number | null;
          first_name: string;
          last_name: string;
          email: string | null;
          email_normalized: string | null;
          phone: string | null;
          phone_normalized: string | null;
        } & Timestamps;
        Insert: {
          household_id?: number | null;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["parents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "parents_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          id: number;
          household_id: number | null;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          grade: string;
          arabic_level: string | null;
          studied_arabic_before: boolean | null;
          gender: "male" | "female" | null;
        } & Timestamps;
        Insert: {
          household_id?: number | null;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          grade: string;
          arabic_level?: string | null;
          studied_arabic_before?: boolean | null;
          gender?: "male" | "female" | null;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "students_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      student_parents: {
        Row: {
          student_id: number;
          parent_id: number;
          relationship: string;
          is_primary_contact: boolean;
          created_at: string;
        };
        Insert: {
          student_id: number;
          parent_id: number;
          relationship: string;
          is_primary_contact?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["student_parents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "student_parents_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_parents_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
        ];
      };
      student_health_notes: {
        Row: {
          student_id: number;
          special_considerations: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          student_id: number;
          special_considerations: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_health_notes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "student_health_notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          id: number;
          school_year_id: number;
          name: string;
          minimum_grade: string | null;
          maximum_grade: string | null;
          arabic_level: string | null;
          teacher_name: string | null;
          capacity: number;
          notes: string | null;
        } & Timestamps;
        Insert: {
          school_year_id: number;
          name: string;
          minimum_grade?: string | null;
          maximum_grade?: string | null;
          arabic_level?: string | null;
          teacher_name?: string | null;
          capacity: number;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "groups_school_year_id_fkey";
            columns: ["school_year_id"];
            isOneToOne: false;
            referencedRelation: "school_years";
            referencedColumns: ["id"];
          },
        ];
      };
      registration_submissions: {
        Row: {
          id: number;
          idempotency_key: string;
          household_id: number | null;
          primary_parent_id: number | null;
          submitted_contact: Json;
          result: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      registrations: {
        Row: {
          id: number;
          student_id: number;
          school_year_id: number;
          reference_code: string;
          grade: string;
          status: string;
          is_returning: boolean;
          submission_id: number | null;
          needs_review: boolean;
          review_reasons: string[];
          acknowledgments: Json;
          acknowledged_at: string | null;
          amount_due: number | null;
          payment_status: string;
          payment_note: string | null;
          reported_quran_ability: string | null;
          quran_background_notes: string | null;
          registered_at: string;
          status_changed_at: string | null;
          status_changed_by: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: {
          status?: string;
          grade?: string;
          is_returning?: boolean;
          needs_review?: boolean;
          review_reasons?: string[];
          amount_due?: number | null;
          payment_status?: string;
          payment_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "registrations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registrations_school_year_id_fkey";
            columns: ["school_year_id"];
            isOneToOne: false;
            referencedRelation: "school_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registrations_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "registration_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      student_group_assignments: {
        Row: {
          registration_id: number;
          group_id: number;
          assigned_at: string;
          assigned_by: string | null;
        };
        Insert: {
          registration_id: number;
          group_id: number;
        };
        Update: { group_id?: number };
        Relationships: [
          {
            foreignKeyName: "student_group_assignments_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: true;
            referencedRelation: "registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_group_assignments_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: number;
          registration_id: number;
          amount: number;
          payment_method: string | null;
          receipt_reference: string | null;
          note: string | null;
          paid_at: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          registration_id: number;
          amount: number;
          payment_method?: string | null;
          receipt_reference?: string | null;
          note?: string | null;
          paid_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: false;
            referencedRelation: "registrations";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_profiles: {
        Row: {
          user_id: string;
          full_name: string;
          role: "admin" | "staff";
          is_active: boolean;
        } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      admin_notes: {
        Row: {
          id: number;
          student_id: number;
          registration_id: number | null;
          body: string;
          author_id: string | null;
          created_at: string;
        };
        Insert: {
          student_id: number;
          registration_id?: number | null;
          body: string;
          author_id?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "admin_notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      color_groups: {
        Row: {
          id: number;
          slug: string;
          name: string;
          color_hex: string;
          text_color_hex: string;
          sort_order: number;
          min_age: number | null;
          max_age: number | null;
          gender: "male" | "female" | "any";
          criteria_note: string | null;
          is_active: boolean;
        } & Timestamps;
        Insert: never;
        Update: {
          min_age?: number | null;
          max_age?: number | null;
          gender?: "male" | "female" | "any";
          criteria_note?: string | null;
        };
        Relationships: [];
      };
      color_group_assignments: {
        Row: { registration_id: number; color_group_id: number; assigned_at: string; assigned_by: string | null };
        Insert: { registration_id: number; color_group_id: number };
        Update: { color_group_id?: number };
        Relationships: [
          {
            foreignKeyName: "color_group_assignments_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: true;
            referencedRelation: "registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "color_group_assignments_color_group_id_fkey";
            columns: ["color_group_id"];
            isOneToOne: false;
            referencedRelation: "color_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      quran_levels: {
        Row: { id: number; name: string; sort_order: number; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      teachers: {
        Row: { id: number; full_name: string; email: string | null; notes: string | null; is_active: boolean } & Timestamps;
        Insert: { full_name: string; email?: string | null; notes?: string | null; is_active?: boolean };
        Update: { full_name?: string; email?: string | null; notes?: string | null; is_active?: boolean };
        Relationships: [];
      };
      teacher_quran_levels: {
        Row: { teacher_id: number; quran_level_id: number; is_active: boolean; created_at: string };
        Insert: { teacher_id: number; quran_level_id: number; is_active?: boolean };
        Update: { is_active?: boolean };
        Relationships: [
          {
            foreignKeyName: "teacher_quran_levels_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_quran_levels_quran_level_id_fkey";
            columns: ["quran_level_id"];
            isOneToOne: false;
            referencedRelation: "quran_levels";
            referencedColumns: ["id"];
          },
        ];
      };
      quran_assignments: {
        Row: {
          id: number;
          student_id: number;
          school_year_id: number;
          quran_level_id: number;
          teacher_id: number | null;
          status: "active" | "ended";
          started_on: string;
          ended_on: string | null;
          note: string | null;
          created_by: string | null;
        } & Timestamps;
        Insert: never;
        Update: { note?: string | null };
        Relationships: [
          {
            foreignKeyName: "quran_assignments_quran_level_id_fkey";
            columns: ["quran_level_id"];
            isOneToOne: false;
            referencedRelation: "quran_levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quran_assignments_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quran_assignments_school_year_id_fkey";
            columns: ["school_year_id"];
            isOneToOne: false;
            referencedRelation: "school_years";
            referencedColumns: ["id"];
          },
        ];
      };
      program_themes: {
        Row: {
          id: number;
          cycle_position: number;
          name: string | null;
          description: string | null;
          main_value: string | null;
          color_hex: string | null;
          is_active: boolean;
          starts_on: string | null;
          ends_on: string | null;
        } & Timestamps;
        Insert: never;
        Update: {
          name?: string | null;
          description?: string | null;
          main_value?: string | null;
          color_hex?: string | null;
          starts_on?: string | null;
          ends_on?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: "insert" | "update" | "delete";
          table_name: string;
          record_id: string;
          changed_fields: string[] | null;
          old_values: Json | null;
          new_values: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      admin_registration_list: {
        Row: {
          registration_id: number;
          reference_code: string;
          school_year_id: number;
          school_year: string;
          status: string;
          is_active: boolean;
          payment_status: string;
          amount_due: number | null;
          amount_paid: number;
          grade: string;
          grade_rank: number | null;
          is_returning: boolean;
          needs_review: boolean;
          reported_quran_ability: string | null;
          registered_at: string;
          updated_at: string;
          student_id: number;
          student_first_name: string;
          student_last_name: string;
          date_of_birth: string;
          gender: "male" | "female" | null;
          studied_arabic_before: boolean | null;
          household_id: number | null;
          color_group_id: number | null;
          color_group_name: string | null;
          color_group_slug: string | null;
          color_group_color: string | null;
          color_group_text_color: string | null;
          quran_assignment_id: number | null;
          quran_level_id: number | null;
          quran_level_name: string | null;
          quran_level_sort: number | null;
          teacher_id: number | null;
          teacher_name: string | null;
          guardian_id: number | null;
          guardian_first_name: string | null;
          guardian_last_name: string | null;
          guardian_email: string | null;
          guardian_phone: string | null;
          search_text: string;
        };
        Relationships: [];
      };
      admin_family_list: {
        Row: {
          id: number;
          display_name: string;
          created_at: string;
          updated_at: string;
          children_count: number;
          guardian_names: string | null;
          guardian_emails: string | null;
          guardian_phones: string | null;
          children_names: string | null;
          search_text: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_open_school_year: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      submit_family_registration: {
        Args: { p_payload: Json; p_idempotency_key: string };
        Returns: Json;
      };
      consume_registration_rate_limit: {
        Args: { p_key_hash: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      admin_dashboard_stats: {
        Args: { p_school_year_id: number };
        Returns: Json;
      };
      admin_set_quran_assignment: {
        Args: {
          p_student_id: number;
          p_school_year_id: number;
          p_quran_level_id: number | null;
          p_teacher_id: number | null;
          p_note?: string | null;
        };
        Returns: number | null;
      };
      admin_bulk_set_quran_assignment: {
        Args: { p_student_ids: number[]; p_school_year_id: number; p_quran_level_id: number | null; p_teacher_id: number | null };
        Returns: number;
      };
      admin_set_active_theme: {
        Args: { p_theme_id: number | null };
        Returns: undefined;
      };
      get_active_theme: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_add_guardian: {
        Args: {
          p_household_id: number;
          p_first_name: string;
          p_last_name: string;
          p_email: string | null;
          p_phone: string | null;
          p_relationship: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type TableRow<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type ViewRow<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
