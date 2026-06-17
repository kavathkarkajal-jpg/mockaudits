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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_questions: {
        Row: {
          brand_id: string | null
          created_at: string
          display_order: number
          id: string
          max_score: number
          options: Json
          question_text: string
          question_type: string
          required: boolean
          section_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          max_score?: number
          options?: Json
          question_text: string
          question_type?: string
          required?: boolean
          section_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          max_score?: number
          options?: Json
          question_text?: string
          question_type?: string
          required?: boolean
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_questions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "audit_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_section_scores: {
        Row: {
          created_at: string
          id: string
          score: number
          section_id: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          score: number
          section_id?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          score?: number
          section_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_section_scores_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "audit_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_section_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "audit_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_sections: {
        Row: {
          brand_id: string
          created_at: string
          display_order: number
          id: string
          name: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_sections_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_sessions: {
        Row: {
          conducted_by: string
          created_at: string
          employee_id: string
          id: string
          needs_reaudit: boolean
          notes: string | null
          reaudit_cleared_at: string | null
          score: number
          submitted_at: string
          week_start_date: string
        }
        Insert: {
          conducted_by: string
          created_at?: string
          employee_id: string
          id?: string
          needs_reaudit?: boolean
          notes?: string | null
          reaudit_cleared_at?: string | null
          score?: number
          submitted_at?: string
          week_start_date: string
        }
        Update: {
          conducted_by?: string
          created_at?: string
          employee_id?: string
          id?: string
          needs_reaudit?: boolean
          notes?: string | null
          reaudit_cleared_at?: string | null
          score?: number
          submitted_at?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          primary_color: string
          reaudit_threshold: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          primary_color?: string
          reaudit_threshold?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          primary_color?: string
          reaudit_threshold?: number | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          employee_code: string
          id: string
          name: string
          store_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          employee_code: string
          id?: string
          name: string
          store_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          employee_code?: string
          id?: string
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          brand_id: string | null
          created_at: string
          full_name: string | null
          id: string
          region: string | null
          store_code: string
          store_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          region?: string | null
          store_code: string
          store_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          region?: string | null
          store_code?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          region: string
          store_code: string
          store_name: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          region?: string
          store_code: string
          store_name: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          region?: string
          store_code?: string
          store_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_brand: { Args: { _brand_id: string }; Returns: boolean }
      can_access_store: { Args: { _store_id: string }; Returns: boolean }
      current_brand_id: { Args: never; Returns: string }
      current_region: { Args: never; Returns: string }
      current_store_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      week_monday: { Args: { ts: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "store_manager"
        | "regional_manager"
        | "trainer"
        | "business_head"
        | "admin"
        | "operations_head"
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
      app_role: [
        "store_manager",
        "regional_manager",
        "trainer",
        "business_head",
        "admin",
        "operations_head",
      ],
    },
  },
} as const
