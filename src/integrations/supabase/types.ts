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
      bot_flows: {
        Row: {
          blocks: Json
          bot_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          bot_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          bot_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_flows_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_templates: {
        Row: {
          created_at: string
          description: string | null
          flow: Json
          icon: string | null
          id: string
          name: string
          segment: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flow?: Json
          icon?: string | null
          id?: string
          name: string
          segment: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flow?: Json
          icon?: string | null
          id?: string
          name?: string
          segment?: string
          slug?: string
        }
        Relationships: []
      }
      bots: {
        Row: {
          avatar_url: string | null
          away_message: string | null
          bot_type: string
          created_at: string
          greeting_afternoon: string | null
          greeting_evening: string | null
          greeting_morning: string | null
          id: string
          is_active: boolean
          menu_delivery: string
          name: string
          segment: string | null
          store_id: string | null
          template_slug: string | null
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          away_message?: string | null
          bot_type?: string
          created_at?: string
          greeting_afternoon?: string | null
          greeting_evening?: string | null
          greeting_morning?: string | null
          id?: string
          is_active?: boolean
          menu_delivery?: string
          name: string
          segment?: string | null
          store_id?: string | null
          template_slug?: string | null
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          away_message?: string | null
          bot_type?: string
          created_at?: string
          greeting_afternoon?: string | null
          greeting_evening?: string | null
          greeting_morning?: string | null
          id?: string
          is_active?: boolean
          menu_delivery?: string
          name?: string
          segment?: string | null
          store_id?: string | null
          template_slug?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          bot_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_message_at: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          note: string | null
          price_override_cents: number | null
          product_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          note?: string | null
          price_override_cents?: number | null
          product_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          note?: string | null
          price_override_cents?: number | null
          product_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_templates: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          segment: string | null
          slug: string
          suggested_items: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          segment?: string | null
          slug: string
          suggested_items?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          segment?: string | null
          slug?: string
          suggested_items?: Json
        }
        Relationships: []
      }
      menus: {
        Row: {
          bot_id: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          header_image_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
          subtitle: string | null
          template_slug: string | null
          theme: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          header_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
          subtitle?: string | null
          template_slug?: string | null
          theme?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          header_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
          subtitle?: string | null
          template_slug?: string | null
          theme?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          bot_id: string
          content: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          user_id: string
          wa_message_id: string | null
        }
        Insert: {
          bot_id: string
          content: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          user_id: string
          wa_message_id?: string | null
        }
        Update: {
          bot_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          user_id?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          bot_id: string
          created_at: string
          from_status: string | null
          id: string
          message: string | null
          metadata: Json
          order_id: string
          to_status: string | null
          type: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          order_id: string
          to_status?: string | null
          type: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          order_id?: string
          to_status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bot_id: string
          channel: string
          code: string
          conversation_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          dispute_status: string | null
          fee_percent: number | null
          id: string
          items: Json
          last_reconciled_at: string | null
          net_amount_cents: number | null
          notes: string | null
          official_payment: boolean
          paid_at: string | null
          payment_provider: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_text: string | null
          platform_fee_cents: number | null
          preparing_at: string | null
          provider_charge_id: string | null
          provider_payment_status: string | null
          ready_at: string | null
          reconcile_attempts: number
          refund_reason: string | null
          refund_status: string | null
          refunded_at: string | null
          refunded_cents: number
          split_status: string | null
          status: string
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          channel?: string
          code?: string
          conversation_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          dispute_status?: string | null
          fee_percent?: number | null
          id?: string
          items?: Json
          last_reconciled_at?: string | null
          net_amount_cents?: number | null
          notes?: string | null
          official_payment?: boolean
          paid_at?: string | null
          payment_provider?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_text?: string | null
          platform_fee_cents?: number | null
          preparing_at?: string | null
          provider_charge_id?: string | null
          provider_payment_status?: string | null
          ready_at?: string | null
          reconcile_attempts?: number
          refund_reason?: string | null
          refund_status?: string | null
          refunded_at?: string | null
          refunded_cents?: number
          split_status?: string | null
          status?: string
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          channel?: string
          code?: string
          conversation_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          dispute_status?: string | null
          fee_percent?: number | null
          id?: string
          items?: Json
          last_reconciled_at?: string | null
          net_amount_cents?: number | null
          notes?: string | null
          official_payment?: boolean
          paid_at?: string | null
          payment_provider?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_text?: string | null
          platform_fee_cents?: number | null
          preparing_at?: string | null
          provider_charge_id?: string | null
          provider_payment_status?: string | null
          ready_at?: string | null
          reconcile_attempts?: number
          refund_reason?: string | null
          refund_status?: string | null
          refunded_at?: string | null
          refunded_cents?: number
          split_status?: string | null
          status?: string
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount_cents: number
          bot_id: string | null
          created_at: string
          id: string
          kind: string
          message: string | null
          order_id: string | null
          provider: string | null
          raw: Json
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          bot_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          order_id?: string | null
          provider?: string | null
          raw?: Json
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          bot_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          order_id?: string | null
          provider?: string | null
          raw?: Json
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          asaas_api_key: string | null
          beneficiary_city: string | null
          beneficiary_name: string | null
          bot_id: string
          created_at: string
          id: string
          is_enabled: boolean
          mp_access_token: string | null
          pix_key: string | null
          pix_key_type: string | null
          preferred_mode: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_api_key?: string | null
          beneficiary_city?: string | null
          beneficiary_name?: string | null
          bot_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          mp_access_token?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          preferred_mode?: string | null
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_api_key?: string | null
          beneficiary_city?: string | null
          beneficiary_name?: string | null
          bot_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          mp_access_token?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          preferred_mode?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fee_ledger: {
        Row: {
          bot_id: string | null
          created_at: string
          fee_cents: number
          fee_percent: number
          gross_cents: number
          id: string
          metadata: Json
          net_cents: number
          order_id: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          fee_cents: number
          fee_percent: number
          gross_cents: number
          id?: string
          metadata?: Json
          net_cents: number
          order_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          fee_cents?: number
          fee_percent?: number
          gross_cents?: number
          id?: string
          metadata?: Json
          net_cents?: number
          order_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_fee_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          ads_threshold: number
          created_at: string
          fee_percent: number
          id: boolean
          platform_asaas_wallet_id: string | null
          platform_mp_user_id: string | null
          platform_pix_city: string | null
          platform_pix_key: string | null
          platform_pix_name: string | null
          split_provider: string
          updated_at: string
        }
        Insert: {
          ads_threshold?: number
          created_at?: string
          fee_percent?: number
          id?: boolean
          platform_asaas_wallet_id?: string | null
          platform_mp_user_id?: string | null
          platform_pix_city?: string | null
          platform_pix_key?: string | null
          platform_pix_name?: string | null
          split_provider?: string
          updated_at?: string
        }
        Update: {
          ads_threshold?: number
          created_at?: string
          fee_percent?: number
          id?: boolean
          platform_asaas_wallet_id?: string | null
          platform_mp_user_id?: string | null
          platform_pix_city?: string | null
          platform_pix_key?: string | null
          platform_pix_name?: string | null
          split_provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          product_id: string
          sort_order: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          max_select: number
          min_select: number
          name: string
          product_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          name: string
          product_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          name?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_available: boolean
          name: string
          price_cents: number
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_available?: boolean
          name: string
          price_cents?: number
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_available?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          bot_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_cents: number
          sku: string | null
          sort_order: number
          stock_quantity: number
          track_stock: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_cents?: number
          sku?: string | null
          sort_order?: number
          stock_quantity?: number
          track_stock?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_cents?: number
          sku?: string | null
          sort_order?: number
          stock_quantity?: number
          track_stock?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          ads_enabled: boolean
          business_name: string | null
          channels: Json
          created_at: string
          current_channel: string | null
          full_name: string | null
          goals: Json
          id: string
          last_official_payment_at: string | null
          logo_url: string | null
          main_goal: string | null
          onboarding_completed: boolean
          plan: string
          preferred_payment_provider: string | null
          public_instagram: string | null
          public_whatsapp: string | null
          segment: string | null
          store_color: string | null
          store_description: string | null
          terms_accepted_at: string | null
          unofficial_streak: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          ads_enabled?: boolean
          business_name?: string | null
          channels?: Json
          created_at?: string
          current_channel?: string | null
          full_name?: string | null
          goals?: Json
          id: string
          last_official_payment_at?: string | null
          logo_url?: string | null
          main_goal?: string | null
          onboarding_completed?: boolean
          plan?: string
          preferred_payment_provider?: string | null
          public_instagram?: string | null
          public_whatsapp?: string | null
          segment?: string | null
          store_color?: string | null
          store_description?: string | null
          terms_accepted_at?: string | null
          unofficial_streak?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          ads_enabled?: boolean
          business_name?: string | null
          channels?: Json
          created_at?: string
          current_channel?: string | null
          full_name?: string | null
          goals?: Json
          id?: string
          last_official_payment_at?: string | null
          logo_url?: string | null
          main_goal?: string | null
          onboarding_completed?: boolean
          plan?: string
          preferred_payment_provider?: string | null
          public_instagram?: string | null
          public_whatsapp?: string | null
          segment?: string | null
          store_color?: string | null
          store_description?: string | null
          terms_accepted_at?: string | null
          unofficial_streak?: number
          updated_at?: string
        }
        Relationships: []
      }
      quick_messages: {
        Row: {
          body: string
          bot_id: string | null
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          bot_id?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          bot_id?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          bot_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_categories_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          bot_id: string
          category_id: string | null
          created_at: string
          id: string
          is_available: boolean
          is_featured: boolean
          price_override_cents: number | null
          product_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          category_id?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          is_featured?: boolean
          price_override_cents?: number | null
          product_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          category_id?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          is_featured?: boolean
          price_override_cents?: number | null
          product_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_products_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_primary: boolean
          logo_url: string | null
          name: string
          public_instagram: string | null
          public_whatsapp: string | null
          segment: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          logo_url?: string | null
          name: string
          public_instagram?: string | null
          public_whatsapp?: string | null
          segment?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          logo_url?: string | null
          name?: string
          public_instagram?: string | null
          public_whatsapp?: string | null
          segment?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_rate_limits: {
        Row: {
          bot_id: string
          count: number
          customer_phone: string
          window_start: string
        }
        Insert: {
          bot_id: string
          count?: number
          customer_phone: string
          window_start?: string
        }
        Update: {
          bot_id?: string
          count?: number
          customer_phone?: string
          window_start?: string
        }
        Relationships: []
      }
      whatsapp_credentials: {
        Row: {
          access_token: string | null
          bot_id: string
          business_account_id: string | null
          created_at: string
          display_phone_number: string | null
          id: string
          is_connected: boolean
          phone_number_id: string | null
          updated_at: string
          user_id: string
          verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          bot_id: string
          business_account_id?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          is_connected?: boolean
          phone_number_id?: string | null
          updated_at?: string
          user_id: string
          verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          bot_id?: string
          business_account_id?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          is_connected?: boolean
          phone_number_id?: string | null
          updated_at?: string
          user_id?: string
          verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credentials_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          accent_color: string | null
          accept_orders: boolean
          address: string | null
          bot_id: string
          button_style: string
          buy_message_template: string | null
          contact_buttons: Json | null
          cover_url: string | null
          created_at: string
          fallback_message: string | null
          font_family: string | null
          hours_json: Json | null
          id: string
          instagram_url: string | null
          layout_json: Json
          logo_url: string | null
          order_confirmation: string | null
          phone_number: string | null
          post_sale_thanks: string | null
          require_address: boolean
          secondary_color: string | null
          store_description: string | null
          store_enabled: boolean
          store_slug: string | null
          store_title: string | null
          template_slug: string | null
          text_color: string | null
          theme_color: string | null
          tiktok_url: string | null
          updated_at: string
          use_native_catalog: boolean
          user_id: string
          welcome_first_contact: string | null
        }
        Insert: {
          accent_color?: string | null
          accept_orders?: boolean
          address?: string | null
          bot_id: string
          button_style?: string
          buy_message_template?: string | null
          contact_buttons?: Json | null
          cover_url?: string | null
          created_at?: string
          fallback_message?: string | null
          font_family?: string | null
          hours_json?: Json | null
          id?: string
          instagram_url?: string | null
          layout_json?: Json
          logo_url?: string | null
          order_confirmation?: string | null
          phone_number?: string | null
          post_sale_thanks?: string | null
          require_address?: boolean
          secondary_color?: string | null
          store_description?: string | null
          store_enabled?: boolean
          store_slug?: string | null
          store_title?: string | null
          template_slug?: string | null
          text_color?: string | null
          theme_color?: string | null
          tiktok_url?: string | null
          updated_at?: string
          use_native_catalog?: boolean
          user_id: string
          welcome_first_contact?: string | null
        }
        Update: {
          accent_color?: string | null
          accept_orders?: boolean
          address?: string | null
          bot_id?: string
          button_style?: string
          buy_message_template?: string | null
          contact_buttons?: Json | null
          cover_url?: string | null
          created_at?: string
          fallback_message?: string | null
          font_family?: string | null
          hours_json?: Json | null
          id?: string
          instagram_url?: string | null
          layout_json?: Json
          logo_url?: string | null
          order_confirmation?: string | null
          phone_number?: string | null
          post_sale_thanks?: string | null
          require_address?: boolean
          secondary_color?: string | null
          store_description?: string | null
          store_enabled?: boolean
          store_slug?: string | null
          store_title?: string | null
          template_slug?: string | null
          text_color?: string | null
          theme_color?: string | null
          tiktok_url?: string | null
          updated_at?: string
          use_native_catalog?: boolean
          user_id?: string
          welcome_first_contact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_stores: {
        Row: {
          accent_color: string | null
          address: string | null
          bot_id: string | null
          buy_message_template: string | null
          contact_buttons: Json | null
          cover_url: string | null
          font_family: string | null
          hours_json: Json | null
          instagram_url: string | null
          logo_url: string | null
          phone_number: string | null
          store_description: string | null
          store_slug: string | null
          store_title: string | null
          theme_color: string | null
          tiktok_url: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          bot_id?: string | null
          buy_message_template?: string | null
          contact_buttons?: Json | null
          cover_url?: string | null
          font_family?: string | null
          hours_json?: Json | null
          instagram_url?: string | null
          logo_url?: string | null
          phone_number?: string | null
          store_description?: string | null
          store_slug?: string | null
          store_title?: string | null
          theme_color?: string | null
          tiktok_url?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          bot_id?: string | null
          buy_message_template?: string | null
          contact_buttons?: Json | null
          cover_url?: string | null
          font_family?: string | null
          hours_json?: Json | null
          instagram_url?: string | null
          logo_url?: string | null
          phone_number?: string | null
          store_description?: string | null
          store_slug?: string | null
          store_title?: string | null
          theme_color?: string | null
          tiktok_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
