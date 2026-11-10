export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      curated_tags: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          label: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_order?: number
          id: string
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          label?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          checkout_session_id: string | null
          checkout_url: string | null
          created_at: string
          external_payment_id: string | null
          fee_amount: number
          id: string
          paid_at: string | null
          reservation_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          checkout_session_id?: string | null
          checkout_url?: string | null
          created_at?: string
          external_payment_id?: string | null
          fee_amount: number
          id?: string
          paid_at?: string | null
          reservation_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          checkout_session_id?: string | null
          checkout_url?: string | null
          created_at?: string
          external_payment_id?: string | null
          fee_amount?: number
          id?: string
          paid_at?: string | null
          reservation_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          booking_token: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          ended_at: string | null
          id: string
          payment_window_ends_at: string
          seeker_id: string
          space_id: string
          status: Database["public"]["Enums"]["reservation_status"]
          unit_id: string | null
          unit_label: string
          updated_at: string
          wait_window: string
          wait_window_ends_at: string | null
        }
        Insert: {
          booking_token?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          payment_window_ends_at: string
          seeker_id: string
          space_id: string
          status?: Database["public"]["Enums"]["reservation_status"]
          unit_id?: string | null
          unit_label: string
          updated_at?: string
          wait_window: string
          wait_window_ends_at?: string | null
        }
        Update: {
          booking_token?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          payment_window_ends_at?: string
          seeker_id?: string
          space_id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          unit_id?: string | null
          unit_label?: string
          updated_at?: string
          wait_window?: string
          wait_window_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      space_curated_tags: {
        Row: {
          created_at: string
          space_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          space_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          space_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_curated_tags_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_curated_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "curated_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      space_custom_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          space_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          space_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_custom_tags_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          address: string
          closes_at: string
          created_at: string
          description: string | null
          host_id: string
          id: string
          latitude: number | null
          longitude: number | null
          max_wait_window: string
          name: string
          opens_at: string
          price_tier: Database["public"]["Enums"]["price_tier"]
          status: Database["public"]["Enums"]["space_status"]
          updated_at: string
        }
        Insert: {
          address: string
          closes_at: string
          created_at?: string
          description?: string | null
          host_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_wait_window?: string
          name: string
          opens_at: string
          price_tier?: Database["public"]["Enums"]["price_tier"]
          status?: Database["public"]["Enums"]["space_status"]
          updated_at?: string
        }
        Update: {
          address?: string
          closes_at?: string
          created_at?: string
          description?: string | null
          host_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_wait_window?: string
          name?: string
          opens_at?: string
          price_tier?: Database["public"]["Enums"]["price_tier"]
          status?: Database["public"]["Enums"]["space_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          capacity: number | null
          col_span: number
          created_at: string
          grid_col: number
          grid_row: number
          host_state: string
          host_updated_at: string
          id: string
          label: string
          space_id: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
          zone_id: string
        }
        Insert: {
          capacity?: number | null
          col_span?: number
          created_at?: string
          grid_col: number
          grid_row: number
          host_state?: string
          host_updated_at?: string
          id?: string
          label: string
          space_id: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          zone_id: string
        }
        Update: {
          capacity?: number | null
          col_span?: number
          created_at?: string
          grid_col?: number
          grid_row?: number
          host_state?: string
          host_updated_at?: string
          id?: string
          label?: string
          space_id?: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_zone_space_fkey"
            columns: ["zone_id", "space_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id", "space_id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          space_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position: number
          space_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attach_checkout_session: {
        Args: {
          p_checkout_session_id: string
          p_checkout_url: string
          p_reservation_id: string
        }
        Returns: Json
      }
      cancel_hold: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["reservation_status"]
          p_reservation_id: string
        }
        Returns: undefined
      }
      confirm_payment: {
        Args: {
          p_checkout_session_id: string
          p_external_payment_id: string
          p_reservation_id: string
        }
        Returns: Json
      }
      hold_terms: {
        Args: { p_space_id: string }
        Returns: {
          fee_amount: number
          is_open: boolean
          max_wait_window_minutes: number
          next_closing_at: string
          payment_window_minutes: number
          wait_window_minutes: number[]
        }[]
      }
      hold_unit: {
        Args: { p_unit_id: string; p_wait_window_minutes: number }
        Returns: {
          checkout_url: string
          created: boolean
          reservation_id: string
          status: Database["public"]["Enums"]["reservation_status"]
        }[]
      }
      my_reservation: {
        Args: { p_reservation_id?: string }
        Returns: {
          booking_token: string
          checkout_session_id: string
          checkout_url: string
          created_at: string
          ended_at: string
          fee_amount: number
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_window_ends_at: string
          space_address: string
          space_id: string
          space_name: string
          status: Database["public"]["Enums"]["reservation_status"]
          unit_id: string
          unit_label: string
          wait_window_ends_at: string
          wait_window_minutes: number
          zone_name: string
        }[]
      }
      reorder_zones: {
        Args: { p_space_id: string; p_zone_ids: string[] }
        Returns: undefined
      }
      set_space_status: {
        Args: {
          p_space_id: string
          p_status: Database["public"]["Enums"]["space_status"]
          p_updated_at: string
        }
        Returns: undefined
      }
      set_unit_state: {
        Args: {
          p_expected_reservation_id?: string
          p_expected_reservation_status?: string
          p_state: string
          p_unit_id: string
        }
        Returns: undefined
      }
      unit_states: {
        Args: { p_space_id: string }
        Returns: {
          host_updated_at: string
          reservation_id: string
          seat_state: string
          unit_id: string
          wait_window_ends_at: string
        }[]
      }
    }
    Enums: {
      payment_status: "pending" | "paid" | "forfeited" | "refunded"
      price_tier: "free" | "budget" | "standard" | "premium"
      reservation_status:
        | "pending_payment"
        | "reserved"
        | "occupied"
        | "expired"
        | "no_show"
        | "completed"
        | "cancelled"
      space_status: "pending" | "verified" | "rejected"
      unit_type: "seat" | "standing_desk" | "room"
      user_role: "seeker" | "host" | "admin"
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
      payment_status: ["pending", "paid", "forfeited", "refunded"],
      price_tier: ["free", "budget", "standard", "premium"],
      reservation_status: [
        "pending_payment",
        "reserved",
        "occupied",
        "expired",
        "no_show",
        "completed",
        "cancelled",
      ],
      space_status: ["pending", "verified", "rejected"],
      unit_type: ["seat", "standing_desk", "room"],
      user_role: ["seeker", "host", "admin"],
    },
  },
} as const

