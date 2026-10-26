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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      answer: {
        Row: {
          auto_correct: boolean | null
          id: string
          photo_lat: number | null
          photo_lng: number | null
          photo_path: string | null
          photo_taken_at: string | null
          question_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string
          teacher_score: number | null
          team_id: string
          value: string | null
        }
        Insert: {
          auto_correct?: boolean | null
          id?: string
          photo_lat?: number | null
          photo_lng?: number | null
          photo_path?: string | null
          photo_taken_at?: string | null
          question_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          teacher_score?: number | null
          team_id: string
          value?: string | null
        }
        Update: {
          auto_correct?: boolean | null
          id?: string
          photo_lat?: number | null
          photo_lng?: number | null
          photo_path?: string | null
          photo_taken_at?: string | null
          question_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          teacher_score?: number | null
          team_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment: {
        Row: {
          expected_value: number | null
          location_id: string
          param_values: Json
          question_id: string
          team_id: string
        }
        Insert: {
          expected_value?: number | null
          location_id: string
          param_values?: Json
          question_id: string
          team_id: string
        }
        Update: {
          expected_value?: number | null
          location_id?: string
          param_values?: Json
          question_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
      flag: {
        Row: {
          detail: Json
          id: string
          resolved_at: string | null
          resolved_by: string | null
          team_id: string
          ts: string
          type: Database["public"]["Enums"]["flag_type"]
        }
        Insert: {
          detail?: Json
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          team_id: string
          ts?: string
          type: Database["public"]["Enums"]["flag_type"]
        }
        Update: {
          detail?: Json
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          team_id?: string
          ts?: string
          type?: Database["public"]["Enums"]["flag_type"]
        }
        Relationships: [
          {
            foreignKeyName: "flag_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flag_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
      location: {
        Row: {
          dwell_s: number
          id: string
          lat: number
          lng: number
          name: string
          position: number
          radius_m: number
          tour_id: string
        }
        Insert: {
          dwell_s?: number
          id?: string
          lat: number
          lng: number
          name: string
          position: number
          radius_m?: number
          tour_id: string
        }
        Update: {
          dwell_s?: number
          id?: string
          lat?: number
          lng?: number
          name?: string
          position?: number
          radius_m?: number
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tour"
            referencedColumns: ["id"]
          },
        ]
      }
      ping: {
        Row: {
          accuracy_m: number
          id: number
          lat: number
          lng: number
          received_at: string
          speed: number | null
          team_id: string
          ts: string
        }
        Insert: {
          accuracy_m: number
          id?: never
          lat: number
          lng: number
          received_at?: string
          speed?: number | null
          team_id: string
          ts: string
        }
        Update: {
          accuracy_m?: number
          id?: never
          lat?: number
          lng?: number
          received_at?: string
          speed?: number | null
          team_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "ping_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
      question: {
        Row: {
          answer_type: Database["public"]["Enums"]["answer_type"]
          base_points: number
          body: string
          correct_value: string | null
          id: string
          level: Database["public"]["Enums"]["niveau"]
          location_id: string
          needs_photo: boolean
          params: Json
          photo_prompt: string | null
          time_limit_s: number | null
          tolerance: number
          unit: string | null
          variant: number
        }
        Insert: {
          answer_type: Database["public"]["Enums"]["answer_type"]
          base_points?: number
          body: string
          correct_value?: string | null
          id?: string
          level: Database["public"]["Enums"]["niveau"]
          location_id: string
          needs_photo?: boolean
          params?: Json
          photo_prompt?: string | null
          time_limit_s?: number | null
          tolerance?: number
          unit?: string | null
          variant?: number
        }
        Update: {
          answer_type?: Database["public"]["Enums"]["answer_type"]
          base_points?: number
          body?: string
          correct_value?: string | null
          id?: string
          level?: Database["public"]["Enums"]["niveau"]
          location_id?: string
          needs_photo?: boolean
          params?: Json
          photo_prompt?: string | null
          time_limit_s?: number | null
          tolerance?: number
          unit?: string | null
          variant?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
        ]
      }
      session: {
        Row: {
          class_label: string
          code: string
          created_at: string
          ends_at: string | null
          id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          tour_id: string
        }
        Insert: {
          class_label?: string
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          tour_id: string
        }
        Update: {
          class_label?: string
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tour"
            referencedColumns: ["id"]
          },
        ]
      }
      session_message: {
        Row: {
          body: string
          created_at: string
          id: string
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_message_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          school: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string
          school?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          school?: string
        }
        Relationships: []
      }
      team: {
        Row: {
          created_at: string
          device_id: string | null
          device_token: string
          id: string
          level: Database["public"]["Enums"]["niveau"] | null
          member_first_names: string[]
          name: string
          session_id: string
          start_index: number
          started_at: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          device_token?: string
          id?: string
          level?: Database["public"]["Enums"]["niveau"] | null
          member_first_names: string[]
          name: string
          session_id: string
          start_index?: number
          started_at?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          device_token?: string
          id?: string
          level?: Database["public"]["Enums"]["niveau"] | null
          member_first_names?: string[]
          name?: string
          session_id?: string
          start_index?: number
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session"
            referencedColumns: ["id"]
          },
        ]
      }
      tour: {
        Row: {
          city: string
          created_at: string
          id: string
          teacher_id: string
          title: string
        }
        Insert: {
          city?: string
          created_at?: string
          id?: string
          teacher_id: string
          title: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
      unlock: {
        Row: {
          deadline_at: string | null
          location_id: string
          team_id: string
          unlocked_at: string
        }
        Insert: {
          deadline_at?: string | null
          location_id: string
          team_id: string
          unlocked_at?: string
        }
        Update: {
          deadline_at?: string | null
          location_id?: string
          team_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      answer_points: {
        Row: {
          answer_id: string | null
          points: number | null
          question_id: string | null
          score: number | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
      team_last_ping: {
        Row: {
          accuracy_m: number | null
          lat: number | null
          lng: number | null
          received_at: string | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ping_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_session_code: { Args: never; Returns: string }
      is_student_email: { Args: { email: string }; Returns: boolean }
      niveau_multiplier: {
        Args: { level: Database["public"]["Enums"]["niveau"] }
        Returns: number
      }
      owns_session: { Args: { p_session_id: string }; Returns: boolean }
      owns_team: { Args: { p_team_id: string }; Returns: boolean }
      owns_tour: { Args: { p_tour_id: string }; Returns: boolean }
      purge_old_pings: { Args: never; Returns: undefined }
    }
    Enums: {
      answer_type: "number" | "text" | "photo"
      flag_type:
        | "gps_jump"
        | "mock_suspected"
        | "low_accuracy"
        | "app_left"
        | "second_device"
      niveau: "basis" | "gevorderd" | "expert"
      session_status: "draft" | "live" | "closed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      answer_type: ["number", "text", "photo"],
      flag_type: [
        "gps_jump",
        "mock_suspected",
        "low_accuracy",
        "app_left",
        "second_device",
      ],
      niveau: ["basis", "gevorderd", "expert"],
      session_status: ["draft", "live", "closed"],
    },
  },
} as const
