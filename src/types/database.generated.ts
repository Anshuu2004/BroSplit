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
      expense_splits: {
        Row: {
          expense_id: string
          is_remainder_payer: boolean
          share: number
          user_id: string
        }
        Insert: {
          expense_id: string
          is_remainder_payer?: boolean
          share: number
          user_id: string
        }
        Update: {
          expense_id?: string
          is_remainder_payer?: boolean
          share?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          group_id: string
          id: string
          idempotency_key: string | null
          name: string
          paid_by: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          currency: string
          deleted_at?: string | null
          group_id: string
          id?: string
          idempotency_key?: string | null
          name: string
          paid_by: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          group_id?: string
          id?: string
          idempotency_key?: string | null
          name?: string
          paid_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          removed_at: string | null
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          removed_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          removed_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          primary_currency: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          name: string
          primary_currency?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          name?: string
          primary_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          group_id: string
          revoked: boolean
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          group_id: string
          revoked?: boolean
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          group_id?: string
          revoked?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          read_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      repayments: {
        Row: {
          amount: number
          creditor_id: string
          currency: string
          debtor_id: string
          description: string | null
          group_id: string
          id: string
          idempotency_key: string | null
          requested_at: string
          settled_at: string | null
          status: Database["public"]["Enums"]["repayment_status"]
        }
        Insert: {
          amount: number
          creditor_id: string
          currency: string
          debtor_id: string
          description?: string | null
          group_id: string
          id?: string
          idempotency_key?: string | null
          requested_at?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["repayment_status"]
        }
        Update: {
          amount?: number
          creditor_id?: string
          currency?: string
          debtor_id?: string
          description?: string | null
          group_id?: string
          id?: string
          idempotency_key?: string | null
          requested_at?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["repayment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "repayments_creditor_id_fkey"
            columns: ["creditor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          email: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      group_balances: {
        Row: {
          currency: string | null
          group_id: string | null
          net_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_repayment: { Args: { p_id: string }; Returns: undefined }
      cancel_repayment: { Args: { p_id: string }; Returns: undefined }
      consume_invite: { Args: { p_token: string }; Returns: string }
      create_expense: {
        Args: {
          p_amount: number
          p_currency: string
          p_group_id: string
          p_idempotency_key?: string
          p_name: string
          p_paid_by: string
          p_participants: string[]
        }
        Returns: string
      }
      delete_expense: { Args: { p_expense_id: string }; Returns: undefined }
      get_member_balance_summary: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: {
          currency: string
          net_balance: number
        }[]
      }
      get_user_open_positions: {
        Args: never
        Returns: {
          amount: number
          counter_name: string
          counterparty: string
          currency: string
          group_id: string
          group_name: string
          role: string
        }[]
      }
      is_group_admin: { Args: { g: string }; Returns: boolean }
      is_group_member: { Args: { g: string }; Returns: boolean }
      leave_group: { Args: { p_group_id: string }; Returns: undefined }
      reject_repayment: { Args: { p_id: string }; Returns: undefined }
      remove_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      request_repayments: {
        Args: { p_group_id: string; p_idempotency_key: string; p_items: Json }
        Returns: string[]
      }
      whoami_debug: { Args: never; Returns: Json }
    }
    Enums: {
      group_role: "admin" | "member"
      notification_type:
        | "GROUP_INVITE"
        | "GROUP_JOINED"
        | "GROUP_REMOVED"
        | "MEMBER_JOINED"
        | "MEMBER_REMOVED"
        | "EXPENSE_ADDED"
        | "EXPENSE_EDITED"
        | "EXPENSE_DELETED"
        | "REPAYMENT_REQUEST"
        | "REPAYMENT_ACCEPTED"
        | "REPAYMENT_REJECTED"
      repayment_status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED"
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
      group_role: ["admin", "member"],
      notification_type: [
        "GROUP_INVITE",
        "GROUP_JOINED",
        "GROUP_REMOVED",
        "MEMBER_JOINED",
        "MEMBER_REMOVED",
        "EXPENSE_ADDED",
        "EXPENSE_EDITED",
        "EXPENSE_DELETED",
        "REPAYMENT_REQUEST",
        "REPAYMENT_ACCEPTED",
        "REPAYMENT_REJECTED",
      ],
      repayment_status: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"],
    },
  },
} as const
