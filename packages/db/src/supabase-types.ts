export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_type"];
          deleted: boolean;
          id: string;
          name: string;
          type: Database["public"]["Enums"]["account_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_type"];
          deleted?: boolean;
          id?: string;
          name: string;
          type: Database["public"]["Enums"]["account_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_type"];
          deleted?: boolean;
          id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["account_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      asset_metals: {
        Row: {
          asset_id: string;
          created_at: string;
          deleted: boolean;
          id: string;
          item_form: string | null;
          metal_type: Database["public"]["Enums"]["metal_type"];
          purity_fraction: number;
          updated_at: string;
          weight_grams: number;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          deleted?: boolean;
          id?: string;
          item_form?: string | null;
          metal_type: Database["public"]["Enums"]["metal_type"];
          purity_fraction?: number;
          updated_at?: string;
          weight_grams: number;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          deleted?: boolean;
          id?: string;
          item_form?: string | null;
          metal_type?: Database["public"]["Enums"]["metal_type"];
          purity_fraction?: number;
          updated_at?: string;
          weight_grams?: number;
        };
        Relationships: [
          {
            foreignKeyName: "asset_metals_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: true;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          created_at: string;
          currency: Database["public"]["Enums"]["currency_type"];
          deleted: boolean;
          id: string;
          is_liquid: boolean;
          name: string;
          notes: string | null;
          purchase_date: string;
          purchase_price: number;
          type: Database["public"]["Enums"]["asset_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_type"];
          deleted?: boolean;
          id?: string;
          is_liquid?: boolean;
          name: string;
          notes?: string | null;
          purchase_date: string;
          purchase_price: number;
          type: Database["public"]["Enums"]["asset_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_type"];
          deleted?: boolean;
          id?: string;
          is_liquid?: boolean;
          name?: string;
          notes?: string | null;
          purchase_date?: string;
          purchase_price?: number;
          type?: Database["public"]["Enums"]["asset_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      bank_details: {
        Row: {
          account_id: string;
          account_number: string | null;
          bank_name: string | null;
          card_last_4: string | null;
          created_at: string;
          deleted: boolean;
          id: string;
          sms_sender_name: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          account_number?: string | null;
          bank_name?: string | null;
          card_last_4?: string | null;
          created_at?: string;
          deleted?: boolean;
          id?: string;
          sms_sender_name?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          account_number?: string | null;
          bank_name?: string | null;
          card_last_4?: string | null;
          created_at?: string;
          deleted?: boolean;
          id?: string;
          sms_sender_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bank_details_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: {
          alert_threshold: number;
          amount: number;
          category_id: string | null;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_type"];
          deleted: boolean;
          id: string;
          name: string;
          period: Database["public"]["Enums"]["budget_period"];
          period_end: string | null;
          period_start: string | null;
          status: Database["public"]["Enums"]["budget_status"];
          type: Database["public"]["Enums"]["budget_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alert_threshold?: number;
          amount: number;
          category_id?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_type"];
          deleted?: boolean;
          id?: string;
          name: string;
          period: Database["public"]["Enums"]["budget_period"];
          period_end?: string | null;
          period_start?: string | null;
          status?: Database["public"]["Enums"]["budget_status"];
          type: Database["public"]["Enums"]["budget_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alert_threshold?: number;
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_type"];
          deleted?: boolean;
          id?: string;
          name?: string;
          period?: Database["public"]["Enums"]["budget_period"];
          period_end?: string | null;
          period_start?: string | null;
          status?: Database["public"]["Enums"]["budget_status"];
          type?: Database["public"]["Enums"]["budget_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string;
          deleted: boolean;
          display_name: string;
          icon: string;
          icon_library: string;
          id: string;
          is_hidden: boolean;
          is_internal: boolean;
          is_system: boolean;
          level: number;
          nature: Database["public"]["Enums"]["category_nature"] | null;
          parent_id: string | null;
          sort_order: number | null;
          system_name: string;
          type: Database["public"]["Enums"]["transaction_type"] | null;
          updated_at: string;
          usage_count: number;
          user_id: string | null;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          deleted?: boolean;
          display_name: string;
          icon: string;
          icon_library?: string;
          id?: string;
          is_hidden?: boolean;
          is_internal?: boolean;
          is_system?: boolean;
          level: number;
          nature?: Database["public"]["Enums"]["category_nature"] | null;
          parent_id?: string | null;
          sort_order?: number | null;
          system_name: string;
          type?: Database["public"]["Enums"]["transaction_type"] | null;
          updated_at?: string;
          usage_count?: number;
          user_id?: string | null;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          deleted?: boolean;
          display_name?: string;
          icon?: string;
          icon_library?: string;
          id?: string;
          is_hidden?: boolean;
          is_internal?: boolean;
          is_system?: boolean;
          level?: number;
          nature?: Database["public"]["Enums"]["category_nature"] | null;
          parent_id?: string | null;
          sort_order?: number | null;
          system_name?: string;
          type?: Database["public"]["Enums"]["transaction_type"] | null;
          updated_at?: string;
          usage_count?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_snapshot_assets: {
        Row: {
          breakdown: Json;
          created_at: string;
          id: string;
          snapshot_date: string;
          total_assets_egp: number;
          user_id: string;
        };
        Insert: {
          breakdown?: Json;
          created_at?: string;
          id?: string;
          snapshot_date?: string;
          total_assets_egp: number;
          user_id: string;
        };
        Update: {
          breakdown?: Json;
          created_at?: string;
          id?: string;
          snapshot_date?: string;
          total_assets_egp?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_snapshot_balance: {
        Row: {
          breakdown: Json;
          created_at: string;
          id: string;
          snapshot_date: string;
          total_accounts_egp: number;
          user_id: string;
        };
        Insert: {
          breakdown?: Json;
          created_at?: string;
          id?: string;
          snapshot_date?: string;
          total_accounts_egp: number;
          user_id: string;
        };
        Update: {
          breakdown?: Json;
          created_at?: string;
          id?: string;
          snapshot_date?: string;
          total_accounts_egp?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_snapshot_net_worth: {
        Row: {
          created_at: string;
          id: string;
          snapshot_date: string;
          total_accounts: number;
          total_assets: number;
          total_net_worth: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          snapshot_date?: string;
          total_accounts?: number;
          total_assets?: number;
          total_net_worth?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          snapshot_date?: string;
          total_accounts?: number;
          total_assets?: number;
          total_net_worth?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      debts: {
        Row: {
          account_id: string;
          created_at: string;
          date: string;
          deleted: boolean;
          due_date: string | null;
          id: string;
          notes: string | null;
          original_amount: number;
          outstanding_amount: number;
          party_name: string;
          status: Database["public"]["Enums"]["debt_status"];
          type: Database["public"]["Enums"]["debt_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          date: string;
          deleted?: boolean;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          original_amount: number;
          outstanding_amount: number;
          party_name: string;
          status?: Database["public"]["Enums"]["debt_status"];
          type: Database["public"]["Enums"]["debt_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          date?: string;
          deleted?: boolean;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          original_amount?: number;
          outstanding_amount?: number;
          party_name?: string;
          status?: Database["public"]["Enums"]["debt_status"];
          type?: Database["public"]["Enums"]["debt_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "debts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      market_rates: {
        Row: {
          aed_egp: number;
          aud_egp: number;
          bhd_egp: number;
          btc_egp: number;
          cad_egp: number;
          chf_egp: number;
          cnh_egp: number;
          cny_egp: number;
          created_at: string;
          dkk_egp: number;
          dzd_egp: number;
          eur_egp: number;
          gbp_egp: number;
          gold_egp_per_gram: number;
          hkd_egp: number;
          id: string;
          inr_egp: number;
          iqd_egp: number;
          isk_egp: number;
          jod_egp: number;
          jpy_egp: number;
          kpw_egp: number;
          krw_egp: number;
          kwd_egp: number;
          lyd_egp: number;
          mad_egp: number;
          myr_egp: number;
          nok_egp: number;
          nzd_egp: number;
          omr_egp: number;
          palladium_egp_per_gram: number;
          platinum_egp_per_gram: number;
          qar_egp: number;
          rub_egp: number;
          sar_egp: number;
          sek_egp: number;
          sgd_egp: number;
          silver_egp_per_gram: number;
          timestamp_currency: string | null;
          timestamp_metal: string | null;
          tnd_egp: number;
          try_egp: number;
          updated_at: string;
          usd_egp: number;
          zar_egp: number;
        };
        Insert: {
          aed_egp: number;
          aud_egp: number;
          bhd_egp: number;
          btc_egp: number;
          cad_egp: number;
          chf_egp: number;
          cnh_egp: number;
          cny_egp: number;
          created_at?: string;
          dkk_egp: number;
          dzd_egp: number;
          eur_egp: number;
          gbp_egp: number;
          gold_egp_per_gram: number;
          hkd_egp: number;
          id?: string;
          inr_egp: number;
          iqd_egp: number;
          isk_egp: number;
          jod_egp: number;
          jpy_egp: number;
          kpw_egp: number;
          krw_egp: number;
          kwd_egp: number;
          lyd_egp: number;
          mad_egp: number;
          myr_egp: number;
          nok_egp: number;
          nzd_egp: number;
          omr_egp: number;
          palladium_egp_per_gram: number;
          platinum_egp_per_gram: number;
          qar_egp: number;
          rub_egp: number;
          sar_egp: number;
          sek_egp: number;
          sgd_egp: number;
          silver_egp_per_gram: number;
          timestamp_currency?: string | null;
          timestamp_metal?: string | null;
          tnd_egp: number;
          try_egp: number;
          updated_at?: string;
          usd_egp: number;
          zar_egp: number;
        };
        Update: {
          aed_egp?: number;
          aud_egp?: number;
          bhd_egp?: number;
          btc_egp?: number;
          cad_egp?: number;
          chf_egp?: number;
          cnh_egp?: number;
          cny_egp?: number;
          created_at?: string;
          dkk_egp?: number;
          dzd_egp?: number;
          eur_egp?: number;
          gbp_egp?: number;
          gold_egp_per_gram?: number;
          hkd_egp?: number;
          id?: string;
          inr_egp?: number;
          iqd_egp?: number;
          isk_egp?: number;
          jod_egp?: number;
          jpy_egp?: number;
          kpw_egp?: number;
          krw_egp?: number;
          kwd_egp?: number;
          lyd_egp?: number;
          mad_egp?: number;
          myr_egp?: number;
          nok_egp?: number;
          nzd_egp?: number;
          omr_egp?: number;
          palladium_egp_per_gram?: number;
          platinum_egp_per_gram?: number;
          qar_egp?: number;
          rub_egp?: number;
          sar_egp?: number;
          sek_egp?: number;
          sgd_egp?: number;
          silver_egp_per_gram?: number;
          timestamp_currency?: string | null;
          timestamp_metal?: string | null;
          tnd_egp?: number;
          try_egp?: number;
          updated_at?: string;
          usd_egp?: number;
          zar_egp?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          deleted: boolean;
          display_name: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          notification_settings: Json | null;
          onboarding_completed: boolean;
          preferred_currency: string;
          sms_detection_enabled: boolean;
          theme: Database["public"]["Enums"]["theme_preference"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          deleted?: boolean;
          display_name?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          notification_settings?: Json | null;
          onboarding_completed?: boolean;
          preferred_currency?: string;
          sms_detection_enabled?: boolean;
          theme?: Database["public"]["Enums"]["theme_preference"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          deleted?: boolean;
          display_name?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          notification_settings?: Json | null;
          onboarding_completed?: boolean;
          preferred_currency?: string;
          sms_detection_enabled?: boolean;
          theme?: Database["public"]["Enums"]["theme_preference"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_payments: {
        Row: {
          account_id: string;
          action: Database["public"]["Enums"]["recurring_action"];
          amount: number;
          category_id: string;
          created_at: string;
          deleted: boolean;
          end_date: string | null;
          frequency: Database["public"]["Enums"]["recurring_frequency"];
          frequency_value: number | null;
          id: string;
          linked_debt_id: string | null;
          name: string;
          next_due_date: string;
          notes: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["recurring_status"];
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          action?: Database["public"]["Enums"]["recurring_action"];
          amount: number;
          category_id: string;
          created_at?: string;
          deleted?: boolean;
          end_date?: string | null;
          frequency: Database["public"]["Enums"]["recurring_frequency"];
          frequency_value?: number | null;
          id?: string;
          linked_debt_id?: string | null;
          name: string;
          next_due_date: string;
          notes?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["recurring_status"];
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          action?: Database["public"]["Enums"]["recurring_action"];
          amount?: number;
          category_id?: string;
          created_at?: string;
          deleted?: boolean;
          end_date?: string | null;
          frequency?: Database["public"]["Enums"]["recurring_frequency"];
          frequency_value?: number | null;
          id?: string;
          linked_debt_id?: string | null;
          name?: string;
          next_due_date?: string;
          notes?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["recurring_status"];
          type?: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_payments_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_payments_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_payments_linked_debt_id_fkey";
            columns: ["linked_debt_id"];
            isOneToOne: false;
            referencedRelation: "debts";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          account_id: string;
          amount: number;
          category_id: string;
          counterparty: string | null;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_type"];
          date: string;
          deleted: boolean;
          id: string;
          is_draft: boolean;
          linked_asset_id: string | null;
          linked_debt_id: string | null;
          linked_recurring_id: string | null;
          note: string | null;
          source: Database["public"]["Enums"]["transaction_source"];
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          amount: number;
          category_id: string;
          counterparty?: string | null;
          created_at?: string;
          currency: Database["public"]["Enums"]["currency_type"];
          date: string;
          deleted?: boolean;
          id?: string;
          is_draft?: boolean;
          linked_asset_id?: string | null;
          linked_debt_id?: string | null;
          linked_recurring_id?: string | null;
          note?: string | null;
          source?: Database["public"]["Enums"]["transaction_source"];
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          amount?: number;
          category_id?: string;
          counterparty?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_type"];
          date?: string;
          deleted?: boolean;
          id?: string;
          is_draft?: boolean;
          linked_asset_id?: string | null;
          linked_debt_id?: string | null;
          linked_recurring_id?: string | null;
          note?: string | null;
          source?: Database["public"]["Enums"]["transaction_source"];
          type?: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_linked_asset_id_fkey";
            columns: ["linked_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_linked_debt_id_fkey";
            columns: ["linked_debt_id"];
            isOneToOne: false;
            referencedRelation: "debts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_linked_recurring_id_fkey";
            columns: ["linked_recurring_id"];
            isOneToOne: false;
            referencedRelation: "recurring_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      transfers: {
        Row: {
          amount: number;
          converted_amount: number | null;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_type"];
          date: string;
          deleted: boolean;
          exchange_rate: number | null;
          from_account_id: string;
          id: string;
          notes: string | null;
          to_account_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          converted_amount?: number | null;
          created_at?: string;
          currency: Database["public"]["Enums"]["currency_type"];
          date: string;
          deleted?: boolean;
          exchange_rate?: number | null;
          from_account_id: string;
          id?: string;
          notes?: string | null;
          to_account_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          converted_amount?: number | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_type"];
          date?: string;
          deleted?: boolean;
          exchange_rate?: number | null;
          from_account_id?: string;
          id?: string;
          notes?: string | null;
          to_account_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey";
            columns: ["from_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey";
            columns: ["to_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      user_category_settings: {
        Row: {
          category_id: string;
          created_at: string;
          deleted: boolean;
          id: string;
          is_hidden: boolean;
          nature: Database["public"]["Enums"]["category_nature"] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          deleted?: boolean;
          id?: string;
          is_hidden?: boolean;
          nature?: Database["public"]["Enums"]["category_nature"] | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          deleted?: boolean;
          id?: string;
          is_hidden?: boolean;
          nature?: Database["public"]["Enums"]["category_nature"] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_category_settings_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      recalculate_account_balance: {
        Args: { account_id_param: string };
        Returns: number;
      };
      recalculate_all_account_balances: { Args: never; Returns: number };
      recalculate_daily_snapshot_assets: { Args: never; Returns: undefined };
      recalculate_daily_snapshot_balance: { Args: never; Returns: undefined };
      recalculate_daily_snapshot_net_worth: { Args: never; Returns: undefined };
      run_daily_snapshots: { Args: never; Returns: undefined };
    };
    Enums: {
      account_type: "CASH" | "BANK" | "DIGITAL_WALLET";
      asset_type: "METAL" | "CRYPTO" | "REAL_ESTATE";
      budget_period: "WEEKLY" | "MONTHLY" | "CUSTOM";
      budget_status: "ACTIVE" | "PAUSED";
      budget_type: "CATEGORY" | "GLOBAL";
      category_nature: "WANT" | "NEED" | "MUST";
      currency_type:
        | "AED"
        | "AUD"
        | "BHD"
        | "BTC"
        | "CAD"
        | "CHF"
        | "CNH"
        | "CNY"
        | "DKK"
        | "DZD"
        | "EGP"
        | "EUR"
        | "GBP"
        | "HKD"
        | "INR"
        | "IQD"
        | "ISK"
        | "JOD"
        | "JPY"
        | "KPW"
        | "KRW"
        | "KWD"
        | "LYD"
        | "MAD"
        | "MYR"
        | "NOK"
        | "NZD"
        | "OMR"
        | "QAR"
        | "RUB"
        | "SAR"
        | "SEK"
        | "SGD"
        | "TND"
        | "TRY"
        | "USD"
        | "ZAR";
      debt_status: "ACTIVE" | "PARTIALLY_PAID" | "SETTLED" | "WRITTEN_OFF";
      debt_type: "LENT" | "BORROWED";
      metal_type: "GOLD" | "SILVER" | "PLATINUM" | "PALLADIUM";
      recurring_action: "AUTO_CREATE" | "NOTIFY";
      recurring_frequency:
        | "DAILY"
        | "WEEKLY"
        | "MONTHLY"
        | "QUARTERLY"
        | "YEARLY"
        | "CUSTOM";
      recurring_status: "ACTIVE" | "PAUSED" | "COMPLETED";
      theme_preference: "LIGHT" | "DARK" | "SYSTEM";
      transaction_source: "MANUAL" | "VOICE" | "SMS" | "RECURRING";
      transaction_type: "EXPENSE" | "INCOME";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_type: ["CASH", "BANK", "DIGITAL_WALLET"],
      asset_type: ["METAL", "CRYPTO", "REAL_ESTATE"],
      budget_period: ["WEEKLY", "MONTHLY", "CUSTOM"],
      budget_status: ["ACTIVE", "PAUSED"],
      budget_type: ["CATEGORY", "GLOBAL"],
      category_nature: ["WANT", "NEED", "MUST"],
      currency_type: [
        "AED",
        "AUD",
        "BHD",
        "BTC",
        "CAD",
        "CHF",
        "CNH",
        "CNY",
        "DKK",
        "DZD",
        "EGP",
        "EUR",
        "GBP",
        "HKD",
        "INR",
        "IQD",
        "ISK",
        "JOD",
        "JPY",
        "KPW",
        "KRW",
        "KWD",
        "LYD",
        "MAD",
        "MYR",
        "NOK",
        "NZD",
        "OMR",
        "QAR",
        "RUB",
        "SAR",
        "SEK",
        "SGD",
        "TND",
        "TRY",
        "USD",
        "ZAR",
      ],
      debt_status: ["ACTIVE", "PARTIALLY_PAID", "SETTLED", "WRITTEN_OFF"],
      debt_type: ["LENT", "BORROWED"],
      metal_type: ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"],
      recurring_action: ["AUTO_CREATE", "NOTIFY"],
      recurring_frequency: [
        "DAILY",
        "WEEKLY",
        "MONTHLY",
        "QUARTERLY",
        "YEARLY",
        "CUSTOM",
      ],
      recurring_status: ["ACTIVE", "PAUSED", "COMPLETED"],
      theme_preference: ["LIGHT", "DARK", "SYSTEM"],
      transaction_source: ["MANUAL", "VOICE", "SMS", "RECURRING"],
      transaction_type: ["EXPENSE", "INCOME"],
    },
  },
} as const;
