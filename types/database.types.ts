export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3";
  };
  public: {
    Tables: {
      account_api_keys: {
        Row: {
          account: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          key_hash: string | null;
          last_used: string | null;
          name: string;
        };
        Insert: {
          account?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          key_hash?: string | null;
          last_used?: string | null;
          name: string;
        };
        Update: {
          account?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          key_hash?: string | null;
          last_used?: string | null;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_api_keys_account_fkey";
            columns: ["account"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_artist_ids: {
        Row: {
          account_id: string | null;
          artist_id: string | null;
          id: string;
          pinned: boolean;
          updated_at: string | null;
        };
        Insert: {
          account_id?: string | null;
          artist_id?: string | null;
          id?: string;
          pinned?: boolean;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string | null;
          artist_id?: string | null;
          id?: string;
          pinned?: boolean;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "account_artist_ids_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_artist_ids_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_artist_profile_preferences: {
        Row: {
          account_id: string;
          artist_id: string;
          created_at: string;
        };
        Insert: {
          account_id: string;
          artist_id: string;
          created_at?: string;
        };
        Update: {
          account_id?: string;
          artist_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_artist_profile_preferences_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_artist_profile_preferences_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_catalogs: {
        Row: {
          account: string;
          catalog: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          account: string;
          catalog: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          account?: string;
          catalog?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_catalogs_account_fkey";
            columns: ["account"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_catalogs_catalog_fkey";
            columns: ["catalog"];
            isOneToOne: false;
            referencedRelation: "catalogs";
            referencedColumns: ["id"];
          },
        ];
      };
      account_emails: {
        Row: {
          account_id: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_emails_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_info: {
        Row: {
          account_id: string | null;
          company_name: string | null;
          id: string;
          image: string | null;
          instruction: string | null;
          job_title: string | null;
          knowledges: Json | null;
          label: string | null;
          organization: string | null;
          role_type: string | null;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          company_name?: string | null;
          id?: string;
          image?: string | null;
          instruction?: string | null;
          job_title?: string | null;
          knowledges?: Json | null;
          label?: string | null;
          organization?: string | null;
          role_type?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          company_name?: string | null;
          id?: string;
          image?: string | null;
          instruction?: string | null;
          job_title?: string | null;
          knowledges?: Json | null;
          label?: string | null;
          organization?: string | null;
          role_type?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_info_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_organization_ids: {
        Row: {
          account_id: string | null;
          id: string;
          organization_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          account_id?: string | null;
          id?: string;
          organization_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string | null;
          id?: string;
          organization_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "account_organization_ids_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_organization_ids_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_phone_numbers: {
        Row: {
          account_id: string;
          id: string;
          phone_number: string;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          id?: string;
          phone_number: string;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          id?: string;
          phone_number?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "account_phone_numbers_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_sandboxes: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          sandbox_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          sandbox_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          sandbox_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_sandboxes_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_snapshots: {
        Row: {
          account_id: string;
          created_at: string | null;
          expires_at: string | null;
          github_repo: string | null;
          snapshot_id: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string | null;
          expires_at?: string | null;
          github_repo?: string | null;
          snapshot_id?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string | null;
          expires_at?: string | null;
          github_repo?: string | null;
          snapshot_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "account_snapshots_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      account_socials: {
        Row: {
          account_id: string | null;
          id: string;
          social_id: string;
        };
        Insert: {
          account_id?: string | null;
          id?: string;
          social_id?: string;
        };
        Update: {
          account_id?: string | null;
          id?: string;
          social_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_socials_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_socials_social_id_fkey";
            columns: ["social_id"];
            isOneToOne: false;
            referencedRelation: "socials";
            referencedColumns: ["id"];
          },
        ];
      };
      account_wallets: {
        Row: {
          account_id: string;
          id: string;
          updated_at: string | null;
          wallet: string;
        };
        Insert: {
          account_id: string;
          id?: string;
          updated_at?: string | null;
          wallet: string;
        };
        Update: {
          account_id?: string;
          id?: string;
          updated_at?: string | null;
          wallet?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_wallets_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      accounts: {
        Row: {
          id: string;
          name: string | null;
          timestamp: number | null;
        };
        Insert: {
          id?: string;
          name?: string | null;
          timestamp?: number | null;
        };
        Update: {
          id?: string;
          name?: string | null;
          timestamp?: number | null;
        };
        Relationships: [];
      };
      accounts_memberships: {
        Row: {
          account_id: string;
          account_role: string;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          account_id: string;
          account_role: string;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          account_role?: string;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_memberships_account_role_fkey";
            columns: ["account_role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["name"];
          },
        ];
      };
      admin_expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          is_active: boolean | null;
          item_name: string;
          updated_at: string | null;
        };
        Insert: {
          amount?: number;
          category: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          item_name: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          item_name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      admin_user_profiles: {
        Row: {
          company: string | null;
          context_notes: string | null;
          created_at: string | null;
          email: string;
          id: string;
          job_title: string | null;
          last_contact_date: string | null;
          meeting_notes: string | null;
          observations: string | null;
          opportunities: string | null;
          pain_points: string | null;
          sentiment: string | null;
          tags: string[] | null;
          updated_at: string | null;
        };
        Insert: {
          company?: string | null;
          context_notes?: string | null;
          created_at?: string | null;
          email: string;
          id?: string;
          job_title?: string | null;
          last_contact_date?: string | null;
          meeting_notes?: string | null;
          observations?: string | null;
          opportunities?: string | null;
          pain_points?: string | null;
          sentiment?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
        };
        Update: {
          company?: string | null;
          context_notes?: string | null;
          created_at?: string | null;
          email?: string;
          id?: string;
          job_title?: string | null;
          last_contact_date?: string | null;
          meeting_notes?: string | null;
          observations?: string | null;
          opportunities?: string | null;
          pain_points?: string | null;
          sentiment?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      agent_status: {
        Row: {
          agent_id: string;
          id: string;
          progress: number | null;
          social_id: string;
          status: number | null;
          updated_at: string;
        };
        Insert: {
          agent_id?: string;
          id?: string;
          progress?: number | null;
          social_id: string;
          status?: number | null;
          updated_at?: string;
        };
        Update: {
          agent_id?: string;
          id?: string;
          progress?: number | null;
          social_id?: string;
          status?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_status_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_status_social_id_fkey";
            columns: ["social_id"];
            isOneToOne: false;
            referencedRelation: "socials";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_template_favorites: {
        Row: {
          created_at: string | null;
          template_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          template_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          template_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_template_favorites_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "agent_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_template_favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_template_shares: {
        Row: {
          created_at: string | null;
          template_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          template_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          template_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_template_shares_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "agent_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_template_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_templates: {
        Row: {
          created_at: string;
          creator: string | null;
          description: string;
          favorites_count: number;
          id: string;
          is_private: boolean;
          prompt: string;
          tags: string[];
          title: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string;
          creator?: string | null;
          description: string;
          favorites_count?: number;
          id?: string;
          is_private?: boolean;
          prompt: string;
          tags?: string[];
          title: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string;
          creator?: string | null;
          description?: string;
          favorites_count?: number;
          id?: string;
          is_private?: boolean;
          prompt?: string;
          tags?: string[];
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_templates_creator_fkey";
            columns: ["creator"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      agents: {
        Row: {
          id: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      apify_scraper_runs: {
        Row: {
          account_id: string | null;
          batch_id: string | null;
          completed_at: string | null;
          created_at: string;
          new_post_urls: Json | null;
          origin: string | null;
          parent_run_id: string | null;
          platform: string | null;
          run_id: string;
          social_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          batch_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          new_post_urls?: Json | null;
          origin?: string | null;
          parent_run_id?: string | null;
          platform?: string | null;
          run_id: string;
          social_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          batch_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          new_post_urls?: Json | null;
          origin?: string | null;
          parent_run_id?: string | null;
          platform?: string | null;
          run_id?: string;
          social_id?: string | null;
        };
        Relationships: [];
      };
      app_store_link_clicked: {
        Row: {
          clientId: string | null;
          id: string | null;
          timestamp: number | null;
        };
        Insert: {
          clientId?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Update: {
          clientId?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Relationships: [];
      };
      apple_music: {
        Row: {
          fanId: string | null;
          game: string | null;
          id: string | null;
          syncid: string | null;
          syncId: string | null;
          timestamp: number | null;
        };
        Insert: {
          fanId?: string | null;
          game?: string | null;
          id?: string | null;
          syncid?: string | null;
          syncId?: string | null;
          timestamp?: number | null;
        };
        Update: {
          fanId?: string | null;
          game?: string | null;
          id?: string | null;
          syncid?: string | null;
          syncId?: string | null;
          timestamp?: number | null;
        };
        Relationships: [];
      };
      apple_play_button_clicked: {
        Row: {
          appleId: string | null;
          campaignId: string | null;
          clientId: string | null;
          fanId: string | null;
          game: string | null;
          id: string;
          timestamp: number | null;
        };
        Insert: {
          appleId?: string | null;
          campaignId?: string | null;
          clientId?: string | null;
          fanId?: string | null;
          game?: string | null;
          id?: string;
          timestamp?: number | null;
        };
        Update: {
          appleId?: string | null;
          campaignId?: string | null;
          clientId?: string | null;
          fanId?: string | null;
          game?: string | null;
          id?: string;
          timestamp?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "apple_play_button_clicked_campaignId_fkey";
            columns: ["campaignId"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      artist_organization_ids: {
        Row: {
          artist_id: string;
          created_at: string | null;
          id: string;
          organization_id: string;
          updated_at: string | null;
        };
        Insert: {
          artist_id: string;
          created_at?: string | null;
          id?: string;
          organization_id: string;
          updated_at?: string | null;
        };
        Update: {
          artist_id?: string;
          created_at?: string | null;
          id?: string;
          organization_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "artist_organization_ids_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "artist_organization_ids_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      artist_segments: {
        Row: {
          artist_account_id: string;
          id: string;
          segment_id: string;
          updated_at: string | null;
        };
        Insert: {
          artist_account_id: string;
          id?: string;
          segment_id: string;
          updated_at?: string | null;
        };
        Update: {
          artist_account_id?: string;
          id?: string;
          segment_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "artist_segments_artist_account_id_fkey";
            columns: ["artist_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "artist_segments_segment_id_fkey";
            columns: ["segment_id"];
            isOneToOne: false;
            referencedRelation: "segments";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_customers: {
        Row: {
          account_id: string;
          customer_id: string;
          email: string | null;
          id: number;
          provider: Database["public"]["Enums"]["billing_provider"];
        };
        Insert: {
          account_id: string;
          customer_id: string;
          email?: string | null;
          id?: number;
          provider: Database["public"]["Enums"]["billing_provider"];
        };
        Update: {
          account_id?: string;
          customer_id?: string;
          email?: string | null;
          id?: number;
          provider?: Database["public"]["Enums"]["billing_provider"];
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          artist_id: string | null;
          clientId: string | null;
          id: string;
          timestamp: number | null;
        };
        Insert: {
          artist_id?: string | null;
          clientId?: string | null;
          id?: string;
          timestamp?: number | null;
        };
        Update: {
          artist_id?: string | null;
          clientId?: string | null;
          id?: string;
          timestamp?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_songs: {
        Row: {
          catalog: string;
          created_at: string;
          id: string;
          song: string;
          updated_at: string;
        };
        Insert: {
          catalog: string;
          created_at?: string;
          id?: string;
          song: string;
          updated_at?: string;
        };
        Update: {
          catalog?: string;
          created_at?: string;
          id?: string;
          song?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_songs_catalog_fkey";
            columns: ["catalog"];
            isOneToOne: false;
            referencedRelation: "catalogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_songs_song_fkey";
            columns: ["song"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["isrc"];
          },
        ];
      };
      catalog_stream_observations: {
        Row: {
          catalog_id: string;
          date: string;
          isrc: string;
          provider_recording_id: string;
          retrieved_at: string;
          run_id: string;
          source_hash: string;
          streams: number | null;
        };
        Insert: {
          catalog_id: string;
          date: string;
          isrc: string;
          provider_recording_id: string;
          retrieved_at: string;
          run_id: string;
          source_hash: string;
          streams?: number | null;
        };
        Update: {
          catalog_id?: string;
          date?: string;
          isrc?: string;
          provider_recording_id?: string;
          retrieved_at?: string;
          run_id?: string;
          source_hash?: string;
          streams?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_stream_observations_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "catalog_stream_tracking";
            referencedColumns: ["catalog_id"];
          },
          {
            foreignKeyName: "catalog_stream_observations_isrc_fkey";
            columns: ["isrc"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["isrc"];
          },
          {
            foreignKeyName: "catalog_stream_observations_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "catalog_stream_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_stream_runs: {
        Row: {
          catalog_id: string;
          coverage: Json;
          created_at: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          revision: string;
          scheduled_day: string;
          since: string;
          status: string;
          until: string;
        };
        Insert: {
          catalog_id: string;
          coverage?: Json;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          revision: string;
          scheduled_day: string;
          since: string;
          status?: string;
          until: string;
        };
        Update: {
          catalog_id?: string;
          coverage?: Json;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          revision?: string;
          scheduled_day?: string;
          since?: string;
          status?: string;
          until?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_stream_runs_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "catalog_stream_tracking";
            referencedColumns: ["catalog_id"];
          },
        ];
      };
      catalog_stream_tracking: {
        Row: {
          catalog_id: string;
          enabled: boolean;
          owner_id: string;
          revision: string;
          updated_at: string;
        };
        Insert: {
          catalog_id: string;
          enabled?: boolean;
          owner_id: string;
          revision?: string;
          updated_at?: string;
        };
        Update: {
          catalog_id?: string;
          enabled?: boolean;
          owner_id?: string;
          revision?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_stream_tracking_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: true;
            referencedRelation: "catalogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_stream_tracking_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_valuations: {
        Row: {
          catalog_id: string;
          created_at: string;
          high: number;
          id: string;
          low: number;
          measured_at: string;
          measured_song_count: number;
          mid: number;
          total_streams: number;
        };
        Insert: {
          catalog_id: string;
          created_at?: string;
          high: number;
          id?: string;
          low: number;
          measured_at?: string;
          measured_song_count: number;
          mid: number;
          total_streams: number;
        };
        Update: {
          catalog_id?: string;
          created_at?: string;
          high?: number;
          id?: string;
          low?: number;
          measured_at?: string;
          measured_song_count?: number;
          mid?: number;
          total_streams?: number;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_valuations_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "catalogs";
            referencedColumns: ["id"];
          },
        ];
      };
      catalogs: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          chat_id: string;
          created_at: string;
          id: string;
          parts: Json;
          role: string;
        };
        Insert: {
          chat_id: string;
          created_at?: string;
          id: string;
          parts: Json;
          role: string;
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          id?: string;
          parts?: Json;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_reads: {
        Row: {
          account_id: string;
          chat_id: string;
          created_at: string;
          last_read_at: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          chat_id: string;
          created_at?: string;
          last_read_at?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          chat_id?: string;
          created_at?: string;
          last_read_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_reads_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_reads_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
        ];
      };
      chats: {
        Row: {
          active_stream_id: string | null;
          created_at: string;
          id: string;
          last_assistant_message_at: string | null;
          model_id: string | null;
          session_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active_stream_id?: string | null;
          created_at?: string;
          id: string;
          last_assistant_message_at?: string | null;
          model_id?: string | null;
          session_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          active_stream_id?: string | null;
          created_at?: string;
          id?: string;
          last_assistant_message_at?: string | null;
          model_id?: string | null;
          session_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chats_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      config: {
        Row: {
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          enable_account_billing: boolean;
          enable_team_account_billing: boolean;
          enable_team_accounts: boolean;
        };
        Insert: {
          billing_provider?: Database["public"]["Enums"]["billing_provider"];
          enable_account_billing?: boolean;
          enable_team_account_billing?: boolean;
          enable_team_accounts?: boolean;
        };
        Update: {
          billing_provider?: Database["public"]["Enums"]["billing_provider"];
          enable_account_billing?: boolean;
          enable_team_account_billing?: boolean;
          enable_team_accounts?: boolean;
        };
        Relationships: [];
      };
      context_attempts: {
        Row: {
          attempt: number;
          error: string | null;
          finished_at: string | null;
          id: string;
          input: Json | null;
          model: string | null;
          module: string;
          owner_id: string;
          provider: string | null;
          provider_cost_micros: number | null;
          provider_cost_status: string;
          provider_request_id: string | null;
          recipe_version: string;
          request_id: string;
          schema_version: string;
          settlement_reference: string | null;
          started_at: string | null;
          status: string;
          trace_storage_path: string | null;
        };
        Insert: {
          attempt: number;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          input?: Json | null;
          model?: string | null;
          module: string;
          owner_id: string;
          provider?: string | null;
          provider_cost_micros?: number | null;
          provider_cost_status?: string;
          provider_request_id?: string | null;
          recipe_version: string;
          request_id: string;
          schema_version: string;
          settlement_reference?: string | null;
          started_at?: string | null;
          status: string;
          trace_storage_path?: string | null;
        };
        Update: {
          attempt?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          input?: Json | null;
          model?: string | null;
          module?: string;
          owner_id?: string;
          provider?: string | null;
          provider_cost_micros?: number | null;
          provider_cost_status?: string;
          provider_request_id?: string | null;
          recipe_version?: string;
          request_id?: string;
          schema_version?: string;
          settlement_reference?: string | null;
          started_at?: string | null;
          status?: string;
          trace_storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "context_attempts_request_id_owner_id_fkey";
            columns: ["request_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_requests";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      context_briefs: {
        Row: {
          created_at: string;
          id: string;
          idempotency_key: string;
          owner_id: string;
          purpose: string;
          request_ids: string[];
          snapshot: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idempotency_key: string;
          owner_id: string;
          purpose: string;
          request_ids: string[];
          snapshot: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          owner_id?: string;
          purpose?: string;
          request_ids?: string[];
          snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "context_briefs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      context_documents: {
        Row: {
          current_result_id: string | null;
          id: string;
          owner_id: string;
          revision: number;
          subject_id: string;
          topic: string;
          updated_at: string;
        };
        Insert: {
          current_result_id?: string | null;
          id?: string;
          owner_id: string;
          revision?: number;
          subject_id: string;
          topic: string;
          updated_at?: string;
        };
        Update: {
          current_result_id?: string | null;
          id?: string;
          owner_id?: string;
          revision?: number;
          subject_id?: string;
          topic?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_documents_current_result_id_owner_id_subject_id_to_fkey";
            columns: ["current_result_id", "owner_id", "subject_id", "topic"];
            isOneToOne: false;
            referencedRelation: "context_results";
            referencedColumns: ["id", "owner_id", "subject_id", "topic"];
          },
          {
            foreignKeyName: "context_documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_documents_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "context_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      context_execution_node_claims: {
        Row: {
          claimed_at: string;
          execution_id: string;
          id: string;
          node_key: string;
          owner_id: string;
        };
        Insert: {
          claimed_at?: string;
          execution_id: string;
          id?: string;
          node_key: string;
          owner_id: string;
        };
        Update: {
          claimed_at?: string;
          execution_id?: string;
          id?: string;
          node_key?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_execution_node_claims_execution_id_owner_id_fkey";
            columns: ["execution_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_executions";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      context_execution_outcomes: {
        Row: {
          execution_id: string;
          node_key: string;
          outcome: Json;
          owner_id: string;
          recorded_at: string;
        };
        Insert: {
          execution_id: string;
          node_key: string;
          outcome: Json;
          owner_id: string;
          recorded_at?: string;
        };
        Update: {
          execution_id?: string;
          node_key?: string;
          outcome?: Json;
          owner_id?: string;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_execution_outcomes_execution_id_owner_id_fkey";
            columns: ["execution_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_executions";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      context_executions: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          plan: Json;
          policy_version: string;
          request_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          owner_id: string;
          plan: Json;
          policy_version: string;
          request_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          plan?: Json;
          policy_version?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_executions_request_id_owner_id_fkey";
            columns: ["request_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_requests";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      context_guest_workspaces: {
        Row: {
          claimed_by: string | null;
          claimed_owner: string | null;
          created_at: string;
          error: string | null;
          expires_at: string;
          id: string;
          input: Json;
          input_fingerprint: string;
          lease_expires_at: string | null;
          payload: Json | null;
          request_id: string | null;
          status: string;
          token_hash: string;
          worker_token: string | null;
        };
        Insert: {
          claimed_by?: string | null;
          claimed_owner?: string | null;
          created_at?: string;
          error?: string | null;
          expires_at?: string;
          id?: string;
          input: Json;
          input_fingerprint: string;
          lease_expires_at?: string | null;
          payload?: Json | null;
          request_id?: string | null;
          status?: string;
          token_hash: string;
          worker_token?: string | null;
        };
        Update: {
          claimed_by?: string | null;
          claimed_owner?: string | null;
          created_at?: string;
          error?: string | null;
          expires_at?: string;
          id?: string;
          input?: Json;
          input_fingerprint?: string;
          lease_expires_at?: string | null;
          payload?: Json | null;
          request_id?: string | null;
          status?: string;
          token_hash?: string;
          worker_token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "context_guest_workspaces_claimed_by_fkey";
            columns: ["claimed_by"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_guest_workspaces_claimed_owner_fkey";
            columns: ["claimed_owner"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_guest_workspaces_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "context_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      context_release_case_reviews: {
        Row: {
          actor_id: string;
          created_at: string;
          decision: string;
          fingerprint: string;
          id: string;
          idempotency_key: string;
          note: string;
          owner_id: string;
          policy_version: string;
          request_id: string;
          snapshot: Json;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          decision: string;
          fingerprint: string;
          id?: string;
          idempotency_key: string;
          note: string;
          owner_id: string;
          policy_version?: string;
          request_id: string;
          snapshot: Json;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          decision?: string;
          fingerprint?: string;
          id?: string;
          idempotency_key?: string;
          note?: string;
          owner_id?: string;
          policy_version?: string;
          request_id?: string;
          snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "context_release_case_reviews_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_release_case_reviews_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_release_case_reviews_request_id_owner_id_fkey";
            columns: ["request_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_requests";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      context_release_corrections: {
        Row: {
          canonical_subject_id: string;
          created_at: string;
          legacy_subject_id: string;
          owner_id: string;
          request_id: string;
          source_result_id: string;
        };
        Insert: {
          canonical_subject_id: string;
          created_at?: string;
          legacy_subject_id: string;
          owner_id: string;
          request_id: string;
          source_result_id: string;
        };
        Update: {
          canonical_subject_id?: string;
          created_at?: string;
          legacy_subject_id?: string;
          owner_id?: string;
          request_id?: string;
          source_result_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_release_corrections_canonical_subject_id_fkey";
            columns: ["canonical_subject_id"];
            isOneToOne: false;
            referencedRelation: "context_subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_release_corrections_legacy_subject_id_fkey";
            columns: ["legacy_subject_id"];
            isOneToOne: false;
            referencedRelation: "context_subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_release_corrections_request_id_owner_id_fkey";
            columns: ["request_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_requests";
            referencedColumns: ["id", "owner_id"];
          },
          {
            foreignKeyName: "context_release_corrections_source_result_id_fkey";
            columns: ["source_result_id"];
            isOneToOne: false;
            referencedRelation: "context_results";
            referencedColumns: ["id"];
          },
        ];
      };
      context_release_track_slots: {
        Row: {
          disc_number: number | null;
          owner_id: string;
          release_subject_id: string;
          slot_index: number;
          source_result_id: string;
          source_topic: string;
          track_number: number | null;
          track_resource_id: string;
        };
        Insert: {
          disc_number?: number | null;
          owner_id: string;
          release_subject_id: string;
          slot_index: number;
          source_result_id: string;
          source_topic?: string;
          track_number?: number | null;
          track_resource_id: string;
        };
        Update: {
          disc_number?: number | null;
          owner_id?: string;
          release_subject_id?: string;
          slot_index?: number;
          source_result_id?: string;
          source_topic?: string;
          track_number?: number | null;
          track_resource_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_release_track_slots_release_subject_id_fkey";
            columns: ["release_subject_id"];
            isOneToOne: false;
            referencedRelation: "context_subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_release_track_slots_source_result_id_owner_id_rele_fkey";
            columns: ["source_result_id", "owner_id", "release_subject_id", "source_topic"];
            isOneToOne: false;
            referencedRelation: "context_results";
            referencedColumns: ["id", "owner_id", "subject_id", "topic"];
          },
          {
            foreignKeyName: "context_release_track_slots_track_resource_id_fkey";
            columns: ["track_resource_id"];
            isOneToOne: false;
            referencedRelation: "context_resources";
            referencedColumns: ["id"];
          },
        ];
      };
      context_request_catalog_members: {
        Row: {
          catalog_id: string;
          catalog_subject_id: string;
          observed_at: string;
          owner_id: string;
          recording_subject_id: string;
          request_id: string;
          song_isrc: string;
        };
        Insert: {
          catalog_id: string;
          catalog_subject_id: string;
          observed_at?: string;
          owner_id: string;
          recording_subject_id: string;
          request_id: string;
          song_isrc: string;
        };
        Update: {
          catalog_id?: string;
          catalog_subject_id?: string;
          observed_at?: string;
          owner_id?: string;
          recording_subject_id?: string;
          request_id?: string;
          song_isrc?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_request_catalog_membe_catalog_subject_id_catalog_i_fkey";
            columns: ["catalog_subject_id", "catalog_id"];
            isOneToOne: false;
            referencedRelation: "context_subjects";
            referencedColumns: ["id", "catalog_id"];
          },
          {
            foreignKeyName: "context_request_catalog_membe_recording_subject_id_song_is_fkey";
            columns: ["recording_subject_id", "song_isrc"];
            isOneToOne: false;
            referencedRelation: "context_subjects";
            referencedColumns: ["id", "song_isrc"];
          },
          {
            foreignKeyName: "context_request_catalog_members_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "catalogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_request_catalog_members_request_id_owner_id_fkey";
            columns: ["request_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_requests";
            referencedColumns: ["id", "owner_id"];
          },
          {
            foreignKeyName: "context_request_catalog_members_song_isrc_fkey";
            columns: ["song_isrc"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["isrc"];
          },
        ];
      };
      context_requests: {
        Row: {
          claim_token: string | null;
          created_at: string;
          created_by: string;
          error: string | null;
          id: string;
          idempotency_key: string;
          input: Json;
          input_fingerprint: string;
          lease_expires_at: string | null;
          output: Json | null;
          owner_id: string;
          resource_id: string;
          revision: number;
          status: string;
          updated_at: string;
          workflow_id: string | null;
        };
        Insert: {
          claim_token?: string | null;
          created_at?: string;
          created_by: string;
          error?: string | null;
          id?: string;
          idempotency_key: string;
          input: Json;
          input_fingerprint: string;
          lease_expires_at?: string | null;
          output?: Json | null;
          owner_id: string;
          resource_id: string;
          revision?: number;
          status?: string;
          updated_at?: string;
          workflow_id?: string | null;
        };
        Update: {
          claim_token?: string | null;
          created_at?: string;
          created_by?: string;
          error?: string | null;
          id?: string;
          idempotency_key?: string;
          input?: Json;
          input_fingerprint?: string;
          lease_expires_at?: string | null;
          output?: Json | null;
          owner_id?: string;
          resource_id?: string;
          revision?: number;
          status?: string;
          updated_at?: string;
          workflow_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "context_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_requests_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_requests_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "context_resources";
            referencedColumns: ["id"];
          },
        ];
      };
      context_resource_links: {
        Row: {
          created_at: string;
          credit_order: number | null;
          credit_role: string | null;
          evidence: Json;
          id: string;
          relation: string;
          resource_id: string;
          status: string;
          subject_id: string;
        };
        Insert: {
          created_at?: string;
          credit_order?: number | null;
          credit_role?: string | null;
          evidence?: Json;
          id?: string;
          relation: string;
          resource_id: string;
          status: string;
          subject_id: string;
        };
        Update: {
          created_at?: string;
          credit_order?: number | null;
          credit_role?: string | null;
          evidence?: Json;
          id?: string;
          relation?: string;
          resource_id?: string;
          status?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_resource_links_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "context_resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_resource_links_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "context_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      context_resources: {
        Row: {
          canonical_url: string;
          created_at: string;
          id: string;
          provider: string;
          provider_id: string;
          resource_kind: string;
        };
        Insert: {
          canonical_url: string;
          created_at?: string;
          id?: string;
          provider: string;
          provider_id: string;
          resource_kind: string;
        };
        Update: {
          canonical_url?: string;
          created_at?: string;
          id?: string;
          provider?: string;
          provider_id?: string;
          resource_kind?: string;
        };
        Relationships: [];
      };
      context_result_sources: {
        Row: {
          owner_id: string;
          result_id: string;
          source_version_id: string;
        };
        Insert: {
          owner_id: string;
          result_id: string;
          source_version_id: string;
        };
        Update: {
          owner_id?: string;
          result_id?: string;
          source_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_result_sources_result_id_owner_id_fkey";
            columns: ["result_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_results";
            referencedColumns: ["id", "owner_id"];
          },
          {
            foreignKeyName: "context_result_sources_source_version_id_owner_id_fkey";
            columns: ["source_version_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_source_versions";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      context_results: {
        Row: {
          attempt_id: string;
          coverage: Json;
          created_at: string;
          evidence_kind: string;
          id: string;
          normalized_response: Json | null;
          owner_id: string;
          raw_response: Json | null;
          reuse_key: string;
          status: string;
          subject_id: string;
          topic: string;
          validation: Json;
        };
        Insert: {
          attempt_id: string;
          coverage: Json;
          created_at?: string;
          evidence_kind: string;
          id?: string;
          normalized_response?: Json | null;
          owner_id: string;
          raw_response?: Json | null;
          reuse_key: string;
          status: string;
          subject_id: string;
          topic: string;
          validation?: Json;
        };
        Update: {
          attempt_id?: string;
          coverage?: Json;
          created_at?: string;
          evidence_kind?: string;
          id?: string;
          normalized_response?: Json | null;
          owner_id?: string;
          raw_response?: Json | null;
          reuse_key?: string;
          status?: string;
          subject_id?: string;
          topic?: string;
          validation?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "context_results_attempt_id_owner_id_fkey";
            columns: ["attempt_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_attempts";
            referencedColumns: ["id", "owner_id"];
          },
          {
            foreignKeyName: "context_results_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "context_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      context_source_versions: {
        Row: {
          content: Json | null;
          date_precision: string;
          event_at: string | null;
          fingerprint: string;
          id: string;
          media_manifest: Json;
          owner_id: string;
          published_at: string | null;
          removed_at: string | null;
          retrieved_at: string;
          source_id: string;
          storage_path: string | null;
        };
        Insert: {
          content?: Json | null;
          date_precision?: string;
          event_at?: string | null;
          fingerprint: string;
          id?: string;
          media_manifest?: Json;
          owner_id: string;
          published_at?: string | null;
          removed_at?: string | null;
          retrieved_at?: string;
          source_id: string;
          storage_path?: string | null;
        };
        Update: {
          content?: Json | null;
          date_precision?: string;
          event_at?: string | null;
          fingerprint?: string;
          id?: string;
          media_manifest?: Json;
          owner_id?: string;
          published_at?: string | null;
          removed_at?: string | null;
          retrieved_at?: string;
          source_id?: string;
          storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "context_source_versions_source_id_owner_id_fkey";
            columns: ["source_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "context_sources";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      context_sources: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          owner_id: string;
          source_url: string | null;
          withdrawn_at: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          owner_id: string;
          source_url?: string | null;
          withdrawn_at?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          owner_id?: string;
          source_url?: string | null;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "context_sources_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      context_subjects: {
        Row: {
          artist_id: string | null;
          catalog_id: string | null;
          created_at: string;
          id: string;
          kind: string;
          resource_id: string | null;
          song_isrc: string | null;
        };
        Insert: {
          artist_id?: string | null;
          catalog_id?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          resource_id?: string | null;
          song_isrc?: string | null;
        };
        Update: {
          artist_id?: string | null;
          catalog_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          resource_id?: string | null;
          song_isrc?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "context_subjects_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_subjects_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "catalogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_subjects_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: true;
            referencedRelation: "context_resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_subjects_song_isrc_fkey";
            columns: ["song_isrc"];
            isOneToOne: true;
            referencedRelation: "songs";
            referencedColumns: ["isrc"];
          },
        ];
      };
      cookie_players: {
        Row: {
          game: string | null;
          id: string | null;
          timestamp: number | null;
          uniquePlayerID: string | null;
        };
        Insert: {
          game?: string | null;
          id?: string | null;
          timestamp?: number | null;
          uniquePlayerID?: string | null;
        };
        Update: {
          game?: string | null;
          id?: string | null;
          timestamp?: number | null;
          uniquePlayerID?: string | null;
        };
        Relationships: [];
      };
      credit_grants: {
        Row: {
          account_id: string;
          created_at: string;
          granted_by: string;
          id: string;
          previous_credits: number | null;
          reason: string;
          remaining_credits: number;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          granted_by: string;
          id?: string;
          previous_credits?: number | null;
          reason: string;
          remaining_credits: number;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          granted_by?: string;
          id?: string;
          previous_credits?: number | null;
          reason?: string;
          remaining_credits?: number;
        };
        Relationships: [
          {
            foreignKeyName: "credit_grants_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_grants_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      credits_usage: {
        Row: {
          account_id: string;
          auto_topup_amount: number | null;
          auto_topup_enabled: boolean;
          auto_topup_last_error: string | null;
          auto_topup_last_run_at: string | null;
          auto_topup_threshold: number | null;
          id: number;
          remaining_credits: number;
          timestamp: string | null;
        };
        Insert: {
          account_id: string;
          auto_topup_amount?: number | null;
          auto_topup_enabled?: boolean;
          auto_topup_last_error?: string | null;
          auto_topup_last_run_at?: string | null;
          auto_topup_threshold?: number | null;
          id?: number;
          remaining_credits?: number;
          timestamp?: string | null;
        };
        Update: {
          account_id?: string;
          auto_topup_amount?: number | null;
          auto_topup_enabled?: boolean;
          auto_topup_last_error?: string | null;
          auto_topup_last_run_at?: string | null;
          auto_topup_threshold?: number | null;
          id?: number;
          remaining_credits?: number;
          timestamp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "credits_usage_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      cta_redirect: {
        Row: {
          clientId: string;
          id: number;
          timestamp: string | null;
          url: string | null;
        };
        Insert: {
          clientId: string;
          id?: number;
          timestamp?: string | null;
          url?: string | null;
        };
        Update: {
          clientId?: string;
          id?: number;
          timestamp?: string | null;
          url?: string | null;
        };
        Relationships: [];
      };
      email_send_log: {
        Row: {
          account_id: string | null;
          chat_id: string | null;
          created_at: string;
          id: string;
          raw_body: string | null;
          resend_id: string | null;
          status: string;
        };
        Insert: {
          account_id?: string | null;
          chat_id?: string | null;
          created_at?: string;
          id?: string;
          raw_body?: string | null;
          resend_id?: string | null;
          status: string;
        };
        Update: {
          account_id?: string | null;
          chat_id?: string | null;
          created_at?: string;
          id?: string;
          raw_body?: string | null;
          resend_id?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      error_logs: {
        Row: {
          account_id: string | null;
          created_at: string;
          error_message: string | null;
          error_timestamp: string | null;
          error_type: string | null;
          id: string;
          last_message: string | null;
          raw_message: string;
          room_id: string | null;
          stack_trace: string | null;
          telegram_message_id: number | null;
          tool_name: string | null;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          error_timestamp?: string | null;
          error_type?: string | null;
          id?: string;
          last_message?: string | null;
          raw_message: string;
          room_id?: string | null;
          stack_trace?: string | null;
          telegram_message_id?: number | null;
          tool_name?: string | null;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          error_timestamp?: string | null;
          error_type?: string | null;
          id?: string;
          last_message?: string | null;
          raw_message?: string;
          room_id?: string | null;
          stack_trace?: string | null;
          telegram_message_id?: number | null;
          tool_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "error_logs_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "error_logs_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      fan_segments: {
        Row: {
          fan_social_id: string;
          id: string;
          segment_id: string;
          updated_at: string | null;
        };
        Insert: {
          fan_social_id: string;
          id?: string;
          segment_id: string;
          updated_at?: string | null;
        };
        Update: {
          fan_social_id?: string;
          id?: string;
          segment_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fan_segments_fan_social_id_fkey";
            columns: ["fan_social_id"];
            isOneToOne: false;
            referencedRelation: "socials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fan_segments_segment_id_fkey";
            columns: ["segment_id"];
            isOneToOne: false;
            referencedRelation: "segments";
            referencedColumns: ["id"];
          },
        ];
      };
      fans: {
        Row: {
          account_status: string | null;
          apple_token: string | null;
          campaign_id: string | null;
          campaign_interaction_count: number | null;
          campaignId: string | null;
          city: string | null;
          click_through_rate: number | null;
          clientId: string | null;
          consent_given: boolean | null;
          country: string | null;
          custom_tags: Json | null;
          discord_username: string | null;
          display_name: string | null;
          email: string | null;
          email_open_rate: number | null;
          engagement_level: string | null;
          episodes: Json | null;
          explicit_content_filter_enabled: boolean | null;
          explicit_content_filter_locked: boolean | null;
          "explicit_content.filter_enabled": boolean | null;
          "explicit_content.filter_locked": boolean | null;
          external_urls_spotify: string | null;
          "external_urls.spotify": string | null;
          facebook_profile_url: string | null;
          first_stream_date: string | null;
          followedArtists: Json | null;
          followers_total: number | null;
          "followers.href": string | null;
          "followers.total": number | null;
          gamification_points: number | null;
          genres: Json | null;
          heavyRotations: Json | null;
          href: string | null;
          id: string;
          images: Json | null;
          instagram_handle: string | null;
          last_campaign_interaction: string | null;
          last_login: string | null;
          last_purchase_date: string | null;
          last_stream_date: string | null;
          linkedin_profile_url: string | null;
          os_type: string | null;
          playlist: Json | null;
          preferences: Json | null;
          preferred_artists: Json | null;
          preferred_device: string | null;
          product: string | null;
          recentlyPlayed: Json | null;
          recommendations: Json | null;
          recommended_events: Json | null;
          reddit_username: string | null;
          saved_podcasts: Json | null;
          savedAlbums: Json | null;
          savedAudioBooks: Json | null;
          savedShows: Json | null;
          savedTracks: Json | null;
          social_shares: number | null;
          spotify_token: string | null;
          subscription_tier: string | null;
          testField: string | null;
          tiktok_handle: string | null;
          time_zone: string | null;
          timestamp: string | null;
          top_artists_long_term: Json | null;
          top_artists_medium_term: Json | null;
          top_tracks_long_term: Json | null;
          top_tracks_medium_term: Json | null;
          top_tracks_short_term: Json | null;
          topArtists: Json | null;
          topTracks: Json | null;
          total_spent: number | null;
          total_streams: number | null;
          twitter_handle: string | null;
          type: string | null;
          uri: string | null;
          youtube_channel_url: string | null;
        };
        Insert: {
          account_status?: string | null;
          apple_token?: string | null;
          campaign_id?: string | null;
          campaign_interaction_count?: number | null;
          campaignId?: string | null;
          city?: string | null;
          click_through_rate?: number | null;
          clientId?: string | null;
          consent_given?: boolean | null;
          country?: string | null;
          custom_tags?: Json | null;
          discord_username?: string | null;
          display_name?: string | null;
          email?: string | null;
          email_open_rate?: number | null;
          engagement_level?: string | null;
          episodes?: Json | null;
          explicit_content_filter_enabled?: boolean | null;
          explicit_content_filter_locked?: boolean | null;
          "explicit_content.filter_enabled"?: boolean | null;
          "explicit_content.filter_locked"?: boolean | null;
          external_urls_spotify?: string | null;
          "external_urls.spotify"?: string | null;
          facebook_profile_url?: string | null;
          first_stream_date?: string | null;
          followedArtists?: Json | null;
          followers_total?: number | null;
          "followers.href"?: string | null;
          "followers.total"?: number | null;
          gamification_points?: number | null;
          genres?: Json | null;
          heavyRotations?: Json | null;
          href?: string | null;
          id?: string;
          images?: Json | null;
          instagram_handle?: string | null;
          last_campaign_interaction?: string | null;
          last_login?: string | null;
          last_purchase_date?: string | null;
          last_stream_date?: string | null;
          linkedin_profile_url?: string | null;
          os_type?: string | null;
          playlist?: Json | null;
          preferences?: Json | null;
          preferred_artists?: Json | null;
          preferred_device?: string | null;
          product?: string | null;
          recentlyPlayed?: Json | null;
          recommendations?: Json | null;
          recommended_events?: Json | null;
          reddit_username?: string | null;
          saved_podcasts?: Json | null;
          savedAlbums?: Json | null;
          savedAudioBooks?: Json | null;
          savedShows?: Json | null;
          savedTracks?: Json | null;
          social_shares?: number | null;
          spotify_token?: string | null;
          subscription_tier?: string | null;
          testField?: string | null;
          tiktok_handle?: string | null;
          time_zone?: string | null;
          timestamp?: string | null;
          top_artists_long_term?: Json | null;
          top_artists_medium_term?: Json | null;
          top_tracks_long_term?: Json | null;
          top_tracks_medium_term?: Json | null;
          top_tracks_short_term?: Json | null;
          topArtists?: Json | null;
          topTracks?: Json | null;
          total_spent?: number | null;
          total_streams?: number | null;
          twitter_handle?: string | null;
          type?: string | null;
          uri?: string | null;
          youtube_channel_url?: string | null;
        };
        Update: {
          account_status?: string | null;
          apple_token?: string | null;
          campaign_id?: string | null;
          campaign_interaction_count?: number | null;
          campaignId?: string | null;
          city?: string | null;
          click_through_rate?: number | null;
          clientId?: string | null;
          consent_given?: boolean | null;
          country?: string | null;
          custom_tags?: Json | null;
          discord_username?: string | null;
          display_name?: string | null;
          email?: string | null;
          email_open_rate?: number | null;
          engagement_level?: string | null;
          episodes?: Json | null;
          explicit_content_filter_enabled?: boolean | null;
          explicit_content_filter_locked?: boolean | null;
          "explicit_content.filter_enabled"?: boolean | null;
          "explicit_content.filter_locked"?: boolean | null;
          external_urls_spotify?: string | null;
          "external_urls.spotify"?: string | null;
          facebook_profile_url?: string | null;
          first_stream_date?: string | null;
          followedArtists?: Json | null;
          followers_total?: number | null;
          "followers.href"?: string | null;
          "followers.total"?: number | null;
          gamification_points?: number | null;
          genres?: Json | null;
          heavyRotations?: Json | null;
          href?: string | null;
          id?: string;
          images?: Json | null;
          instagram_handle?: string | null;
          last_campaign_interaction?: string | null;
          last_login?: string | null;
          last_purchase_date?: string | null;
          last_stream_date?: string | null;
          linkedin_profile_url?: string | null;
          os_type?: string | null;
          playlist?: Json | null;
          preferences?: Json | null;
          preferred_artists?: Json | null;
          preferred_device?: string | null;
          product?: string | null;
          recentlyPlayed?: Json | null;
          recommendations?: Json | null;
          recommended_events?: Json | null;
          reddit_username?: string | null;
          saved_podcasts?: Json | null;
          savedAlbums?: Json | null;
          savedAudioBooks?: Json | null;
          savedShows?: Json | null;
          savedTracks?: Json | null;
          social_shares?: number | null;
          spotify_token?: string | null;
          subscription_tier?: string | null;
          testField?: string | null;
          tiktok_handle?: string | null;
          time_zone?: string | null;
          timestamp?: string | null;
          top_artists_long_term?: Json | null;
          top_artists_medium_term?: Json | null;
          top_tracks_long_term?: Json | null;
          top_tracks_medium_term?: Json | null;
          top_tracks_short_term?: Json | null;
          topArtists?: Json | null;
          topTracks?: Json | null;
          total_spent?: number | null;
          total_streams?: number | null;
          twitter_handle?: string | null;
          type?: string | null;
          uri?: string | null;
          youtube_channel_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fans_campaignId_fkey";
            columns: ["campaignId"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          artist_account_id: string;
          created_at: string;
          description: string | null;
          file_name: string;
          id: string;
          is_directory: boolean;
          mime_type: string | null;
          owner_account_id: string;
          size_bytes: number | null;
          storage_key: string;
          tags: string[] | null;
          updated_at: string;
        };
        Insert: {
          artist_account_id: string;
          created_at?: string;
          description?: string | null;
          file_name: string;
          id?: string;
          is_directory?: boolean;
          mime_type?: string | null;
          owner_account_id: string;
          size_bytes?: number | null;
          storage_key: string;
          tags?: string[] | null;
          updated_at?: string;
        };
        Update: {
          artist_account_id?: string;
          created_at?: string;
          description?: string | null;
          file_name?: string;
          id?: string;
          is_directory?: boolean;
          mime_type?: string | null;
          owner_account_id?: string;
          size_bytes?: number | null;
          storage_key?: string;
          tags?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_artist_account_id_fkey";
            columns: ["artist_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_owner_account_id_fkey";
            columns: ["owner_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          game: string | null;
          id: string | null;
          timestamp: number | null;
        };
        Insert: {
          game?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Update: {
          game?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Relationships: [];
      };
      founder_dashboard_chart_annotations: {
        Row: {
          chart_type: string | null;
          created_at: string | null;
          event_date: string;
          event_description: string | null;
          id: string;
        };
        Insert: {
          chart_type?: string | null;
          created_at?: string | null;
          event_date: string;
          event_description?: string | null;
          id?: string;
        };
        Update: {
          chart_type?: string | null;
          created_at?: string | null;
          event_date?: string;
          event_description?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      funnel_analytics: {
        Row: {
          artist_id: string | null;
          handle: string | null;
          id: string;
          pilot_id: string | null;
          status: number | null;
          type: Database["public"]["Enums"]["social_type"] | null;
          updated_at: string;
        };
        Insert: {
          artist_id?: string | null;
          handle?: string | null;
          id?: string;
          pilot_id?: string | null;
          status?: number | null;
          type?: Database["public"]["Enums"]["social_type"] | null;
          updated_at?: string;
        };
        Update: {
          artist_id?: string | null;
          handle?: string | null;
          id?: string;
          pilot_id?: string | null;
          status?: number | null;
          type?: Database["public"]["Enums"]["social_type"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "funnel_analytics_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      funnel_analytics_accounts: {
        Row: {
          account_id: string | null;
          analysis_id: string | null;
          created_at: string;
          id: string;
          updated_at: string | null;
        };
        Insert: {
          account_id?: string | null;
          analysis_id?: string | null;
          created_at?: string;
          id?: string;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string | null;
          analysis_id?: string | null;
          created_at?: string;
          id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "account_funnel_analytics_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_funnel_analytics_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "funnel_analytics";
            referencedColumns: ["id"];
          },
        ];
      };
      funnel_analytics_segments: {
        Row: {
          analysis_id: string | null;
          created_at: string;
          icon: string | null;
          id: string;
          name: string | null;
          size: number | null;
        };
        Insert: {
          analysis_id?: string | null;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string | null;
          size?: number | null;
        };
        Update: {
          analysis_id?: string | null;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string | null;
          size?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "funnel_analytics_segments_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "funnel_analytics";
            referencedColumns: ["id"];
          },
        ];
      };
      game_start: {
        Row: {
          clientId: string | null;
          fanId: Json | null;
          game: string | null;
          id: string | null;
          timestamp: number | null;
        };
        Insert: {
          clientId?: string | null;
          fanId?: Json | null;
          game?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Update: {
          clientId?: string | null;
          fanId?: Json | null;
          game?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          account_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: number;
          invite_token: string;
          invited_by: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: number;
          invite_token: string;
          invited_by: string;
          role: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: number;
          invite_token?: string;
          invited_by?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["name"];
          },
        ];
      };
      ios_redirect: {
        Row: {
          clientId: string | null;
          fanId: string | null;
          id: string | null;
          timestamp: number | null;
        };
        Insert: {
          clientId?: string | null;
          fanId?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Update: {
          clientId?: string | null;
          fanId?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Relationships: [];
      };
      leaderboard: {
        Row: {
          id: string | null;
          Name: string | null;
          Number: string | null;
          Score: string | null;
          Spotify: string | null;
          "Time._nanoseconds": string | null;
          "Time._seconds": string | null;
        };
        Insert: {
          id?: string | null;
          Name?: string | null;
          Number?: string | null;
          Score?: string | null;
          Spotify?: string | null;
          "Time._nanoseconds"?: string | null;
          "Time._seconds"?: string | null;
        };
        Update: {
          id?: string | null;
          Name?: string | null;
          Number?: string | null;
          Score?: string | null;
          Spotify?: string | null;
          "Time._nanoseconds"?: string | null;
          "Time._seconds"?: string | null;
        };
        Relationships: [];
      };
      leaderboard_boogie: {
        Row: {
          clientId: string | null;
          displayName: string | null;
          fanId: string | null;
          gameType: string | null;
          id: string | null;
          score: number | null;
          timestamp: string | null;
        };
        Insert: {
          clientId?: string | null;
          displayName?: string | null;
          fanId?: string | null;
          gameType?: string | null;
          id?: string | null;
          score?: number | null;
          timestamp?: string | null;
        };
        Update: {
          clientId?: string | null;
          displayName?: string | null;
          fanId?: string | null;
          gameType?: string | null;
          id?: string | null;
          score?: number | null;
          timestamp?: string | null;
        };
        Relationships: [];
      };
      leaderboard_luh_tyler_3d: {
        Row: {
          FanId: string | null;
          id: string | null;
          Score: string | null;
          ScorePerTime: string | null;
          Time: string | null;
          timestamp: string | null;
          UserName: string | null;
        };
        Insert: {
          FanId?: string | null;
          id?: string | null;
          Score?: string | null;
          ScorePerTime?: string | null;
          Time?: string | null;
          timestamp?: string | null;
          UserName?: string | null;
        };
        Update: {
          FanId?: string | null;
          id?: string | null;
          Score?: string | null;
          ScorePerTime?: string | null;
          Time?: string | null;
          timestamp?: string | null;
          UserName?: string | null;
        };
        Relationships: [];
      };
      leaderboard_luv: {
        Row: {
          f: string | null;
          id: string | null;
        };
        Insert: {
          f?: string | null;
          id?: string | null;
        };
        Update: {
          f?: string | null;
          id?: string | null;
        };
        Relationships: [];
      };
      memories: {
        Row: {
          content: Json;
          id: string;
          room_id: string | null;
          updated_at: string;
        };
        Insert: {
          content: Json;
          id?: string;
          room_id?: string | null;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          id?: string;
          room_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memories_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      memory_emails: {
        Row: {
          created_at: string;
          email_id: string;
          id: string;
          memory: string;
          message_id: string;
        };
        Insert: {
          created_at?: string;
          email_id: string;
          id?: string;
          memory: string;
          message_id: string;
        };
        Update: {
          created_at?: string;
          email_id?: string;
          id?: string;
          memory?: string;
          message_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memory_emails_memory_fkey";
            columns: ["memory"];
            isOneToOne: false;
            referencedRelation: "memories";
            referencedColumns: ["id"];
          },
        ];
      };
      music_generations: {
        Row: {
          account_id: string;
          created_at: string;
          duration_seconds: number | null;
          error_message: string | null;
          fal_request_id: string | null;
          id: string;
          lyrics: string;
          model: string;
          prompt: string;
          status: string;
          storage_key: string | null;
          updated_at: string;
          workflow_run_id: string | null;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          duration_seconds?: number | null;
          error_message?: string | null;
          fal_request_id?: string | null;
          id?: string;
          lyrics: string;
          model?: string;
          prompt: string;
          status?: string;
          storage_key?: string | null;
          updated_at?: string;
          workflow_run_id?: string | null;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          duration_seconds?: number | null;
          error_message?: string | null;
          fal_request_id?: string | null;
          id?: string;
          lyrics?: string;
          model?: string;
          prompt?: string;
          status?: string;
          storage_key?: string | null;
          updated_at?: string;
          workflow_run_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "music_generations_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          account_id: string;
          body: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          dismissed: boolean;
          expires_at: string | null;
          id: number;
          link: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Insert: {
          account_id: string;
          body: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          dismissed?: boolean;
          expires_at?: string | null;
          id?: never;
          link?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          account_id?: string;
          body?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          dismissed?: boolean;
          expires_at?: string | null;
          id?: never;
          link?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [];
      };
      oauth_account_identities: {
        Row: {
          account_id: string | null;
          created_at: string;
          provider_app_id: string;
          provider_subject: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          provider_app_id: string;
          provider_subject: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          provider_app_id?: string;
          provider_subject?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_account_identities_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_provider_artifacts: {
        Row: {
          account_hash: string | null;
          consumed_at: string | null;
          created_at: string;
          expires_at: string | null;
          grant_hash: string | null;
          id_hash: string;
          model: string;
          namespace: string;
          payload: string;
          uid_hash: string | null;
          user_code_hash: string | null;
        };
        Insert: {
          account_hash?: string | null;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          grant_hash?: string | null;
          id_hash: string;
          model: string;
          namespace: string;
          payload: string;
          uid_hash?: string | null;
          user_code_hash?: string | null;
        };
        Update: {
          account_hash?: string | null;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          grant_hash?: string | null;
          id_hash?: string;
          model?: string;
          namespace?: string;
          payload?: string;
          uid_hash?: string | null;
          user_code_hash?: string | null;
        };
        Relationships: [];
      };
      oauth_rate_limits: {
        Row: {
          count: number;
          expires_at: string;
          key_hash: string;
          namespace: string;
        };
        Insert: {
          count: number;
          expires_at: string;
          key_hash: string;
          namespace: string;
        };
        Update: {
          count?: number;
          expires_at?: string;
          key_hash?: string;
          namespace?: string;
        };
        Relationships: [];
      };
      oauth_revoked_grants: {
        Row: {
          grant_hash: string;
          namespace: string;
          revoked_at: string;
        };
        Insert: {
          grant_hash: string;
          namespace: string;
          revoked_at?: string;
        };
        Update: {
          grant_hash?: string;
          namespace?: string;
          revoked_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          price_amount: number | null;
          product_id: string;
          quantity: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          order_id: string;
          price_amount?: number | null;
          product_id: string;
          quantity?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          price_amount?: number | null;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          account_id: string;
          billing_customer_id: number;
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          created_at: string;
          currency: string;
          id: string;
          status: Database["public"]["Enums"]["payment_status"];
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          billing_customer_id: number;
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          created_at?: string;
          currency: string;
          id: string;
          status: Database["public"]["Enums"]["payment_status"];
          total_amount: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          billing_customer_id?: number;
          billing_provider?: Database["public"]["Enums"]["billing_provider"];
          created_at?: string;
          currency?: string;
          id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_billing_customer_id_fkey";
            columns: ["billing_customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_domains: {
        Row: {
          created_at: string | null;
          domain: string;
          id: string;
          organization_id: string;
        };
        Insert: {
          created_at?: string | null;
          domain: string;
          id?: string;
          organization_id: string;
        };
        Update: {
          created_at?: string | null;
          domain?: string;
          id?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_domains_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_professionals: {
        Row: {
          confirmation_basis: string;
          confirmed_by: string;
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          roles: string[];
          updated_at: string;
        };
        Insert: {
          confirmation_basis?: string;
          confirmed_by: string;
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          roles: string[];
          updated_at?: string;
        };
        Update: {
          confirmation_basis?: string;
          confirmed_by?: string;
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          roles?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_professionals_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_professionals_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          name: string;
          tokens_quota: number;
          variant_id: string;
        };
        Insert: {
          name: string;
          tokens_quota: number;
          variant_id: string;
        };
        Update: {
          name?: string;
          tokens_quota?: number;
          variant_id?: string;
        };
        Relationships: [];
      };
      playcount_snapshots: {
        Row: {
          account: string;
          album_count: number | null;
          album_ids: string[] | null;
          catalog: string | null;
          created_at: string;
          estimated_cost_usd: number | null;
          id: string;
          isrcs: string[] | null;
          platforms: string[];
          schedule: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          account: string;
          album_count?: number | null;
          album_ids?: string[] | null;
          catalog?: string | null;
          created_at?: string;
          estimated_cost_usd?: number | null;
          id?: string;
          isrcs?: string[] | null;
          platforms: string[];
          schedule?: string;
          state?: string;
          updated_at?: string;
        };
        Update: {
          account?: string;
          album_count?: number | null;
          album_ids?: string[] | null;
          catalog?: string | null;
          created_at?: string;
          estimated_cost_usd?: number | null;
          id?: string;
          isrcs?: string[] | null;
          platforms?: string[];
          schedule?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "playcount_snapshots_account_fkey";
            columns: ["account"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playcount_snapshots_catalog_fkey";
            columns: ["catalog"];
            isOneToOne: false;
            referencedRelation: "catalogs";
            referencedColumns: ["id"];
          },
        ];
      };
      player_fan_contacts: {
        Row: {
          display_name: string | null;
          email: string | null;
          first_connected_at: string;
          id: string;
          last_connected_at: string;
          owner_id: string;
          provider: string;
          provider_id: string;
        };
        Insert: {
          display_name?: string | null;
          email?: string | null;
          first_connected_at?: string;
          id?: string;
          last_connected_at?: string;
          owner_id: string;
          provider: string;
          provider_id: string;
        };
        Update: {
          display_name?: string | null;
          email?: string | null;
          first_connected_at?: string;
          id?: string;
          last_connected_at?: string;
          owner_id?: string;
          provider?: string;
          provider_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_fan_contacts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      player_fans: {
        Row: {
          artist_id: string;
          contact_id: string;
          display_name: string | null;
          email: string | null;
          first_connected_at: string;
          id: string;
          last_connected_at: string;
          owner_id: string;
          provider: string;
          provider_id: string;
        };
        Insert: {
          artist_id: string;
          contact_id: string;
          display_name?: string | null;
          email?: string | null;
          first_connected_at?: string;
          id?: string;
          last_connected_at?: string;
          owner_id: string;
          provider: string;
          provider_id: string;
        };
        Update: {
          artist_id?: string;
          contact_id?: string;
          display_name?: string | null;
          email?: string | null;
          first_connected_at?: string;
          id?: string;
          last_connected_at?: string;
          owner_id?: string;
          provider?: string;
          provider_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_fans_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_fans_contact_identity_fkey";
            columns: ["contact_id", "owner_id", "provider", "provider_id"];
            isOneToOne: false;
            referencedRelation: "player_fan_contacts";
            referencedColumns: ["id", "owner_id", "provider", "provider_id"];
          },
          {
            foreignKeyName: "player_fans_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      player_listening_events: {
        Row: {
          event: string;
          id: string;
          listened_ms: number;
          position_ms: number;
          received_at: string;
          session_id: string;
          track_id: string | null;
        };
        Insert: {
          event: string;
          id: string;
          listened_ms?: number;
          position_ms?: number;
          received_at?: string;
          session_id: string;
          track_id?: string | null;
        };
        Update: {
          event?: string;
          id?: string;
          listened_ms?: number;
          position_ms?: number;
          received_at?: string;
          session_id?: string;
          track_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "player_listening_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "player_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      player_sessions: {
        Row: {
          acquisition: Json;
          connected_at: string | null;
          created_at: string;
          expires_at: string;
          fan_id: string | null;
          id: string;
          last_event_at: string;
          player_id: string;
          provider: string;
          reported_listening_ms: number;
          revision: number;
          scopes: string[];
        };
        Insert: {
          acquisition?: Json;
          connected_at?: string | null;
          created_at?: string;
          expires_at: string;
          fan_id?: string | null;
          id: string;
          last_event_at?: string;
          player_id: string;
          provider: string;
          reported_listening_ms?: number;
          revision: number;
          scopes?: string[];
        };
        Update: {
          acquisition?: Json;
          connected_at?: string | null;
          created_at?: string;
          expires_at?: string;
          fan_id?: string | null;
          id?: string;
          last_event_at?: string;
          player_id?: string;
          provider?: string;
          reported_listening_ms?: number;
          revision?: number;
          scopes?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "player_sessions_fan_id_fkey";
            columns: ["fan_id"];
            isOneToOne: false;
            referencedRelation: "player_fans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_sessions_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "release_players";
            referencedColumns: ["id"];
          },
        ];
      };
      post_comments: {
        Row: {
          comment: string | null;
          commented_at: string;
          id: string;
          post_id: string | null;
          social_id: string | null;
        };
        Insert: {
          comment?: string | null;
          commented_at: string;
          id?: string;
          post_id?: string | null;
          social_id?: string | null;
        };
        Update: {
          comment?: string | null;
          commented_at?: string;
          id?: string;
          post_id?: string | null;
          social_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_social_id_fkey";
            columns: ["social_id"];
            isOneToOne: false;
            referencedRelation: "socials";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          caption: string | null;
          comments: number | null;
          id: string;
          likes: number | null;
          media: Json;
          media_observed_at: string | null;
          post_url: string;
          published_at: string | null;
          reposts: number | null;
          updated_at: string;
          views: number | null;
        };
        Insert: {
          caption?: string | null;
          comments?: number | null;
          id?: string;
          likes?: number | null;
          media?: Json;
          media_observed_at?: string | null;
          post_url: string;
          published_at?: string | null;
          reposts?: number | null;
          updated_at?: string;
          views?: number | null;
        };
        Update: {
          caption?: string | null;
          comments?: number | null;
          id?: string;
          likes?: number | null;
          media?: Json;
          media_observed_at?: string | null;
          post_url?: string;
          published_at?: string | null;
          reposts?: number | null;
          updated_at?: string;
          views?: number | null;
        };
        Relationships: [];
      };
      presave: {
        Row: {
          accessToken: string | null;
          fanId: string | null;
          "fanId.error.code": string | null;
          "fanId.error.name": string | null;
          id: string | null;
          presaveId: string | null;
          presaveReleaseDate: string | null;
          refreshToken: string | null;
          timestamp: number | null;
        };
        Insert: {
          accessToken?: string | null;
          fanId?: string | null;
          "fanId.error.code"?: string | null;
          "fanId.error.name"?: string | null;
          id?: string | null;
          presaveId?: string | null;
          presaveReleaseDate?: string | null;
          refreshToken?: string | null;
          timestamp?: number | null;
        };
        Update: {
          accessToken?: string | null;
          fanId?: string | null;
          "fanId.error.code"?: string | null;
          "fanId.error.name"?: string | null;
          id?: string | null;
          presaveId?: string | null;
          presaveReleaseDate?: string | null;
          refreshToken?: string | null;
          timestamp?: number | null;
        };
        Relationships: [];
      };
      professional_roster_requests: {
        Row: {
          actor_id: string;
          created_at: string;
          input: Json;
          organization_id: string;
          request_key: string;
          result: Json;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          input: Json;
          organization_id: string;
          request_key: string;
          result: Json;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          input?: Json;
          organization_id?: string;
          request_key?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "professional_roster_requests_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professional_roster_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      project_collaborators: {
        Row: {
          account_id: string;
          id: string;
          project_id: string;
        };
        Insert: {
          account_id: string;
          id?: string;
          project_id: string;
        };
        Update: {
          account_id?: string;
          id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_collaborators_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_collaborators_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_task_comments: {
        Row: {
          account_id: string;
          body: string;
          created_at: string;
          id: string;
          task_id: string;
        };
        Insert: {
          account_id: string;
          body: string;
          created_at?: string;
          id?: string;
          task_id: string;
        };
        Update: {
          account_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_task_comments_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_task_comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "project_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      project_tasks: {
        Row: {
          assignee_account_id: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          project_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee_account_id?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          project_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_account_id?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          project_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_account_id_fkey";
            columns: ["assignee_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_tasks_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      pulse_accounts: {
        Row: {
          account_id: string;
          active: boolean;
          id: string;
        };
        Insert: {
          account_id: string;
          active?: boolean;
          id?: string;
        };
        Update: {
          account_id?: string;
          active?: boolean;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pulse_accounts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      release_players: {
        Row: {
          allowed_origins: string[];
          apple_url: string | null;
          artist_id: string;
          artwork: string | null;
          audio_url: string | null;
          created_at: string;
          created_by: string;
          enabled: boolean;
          free_playback: string;
          id: string;
          name: string;
          owner_id: string;
          revision: number;
          spotify_url: string | null;
          updated_at: string;
        };
        Insert: {
          allowed_origins?: string[];
          apple_url?: string | null;
          artist_id: string;
          artwork?: string | null;
          audio_url?: string | null;
          created_at?: string;
          created_by: string;
          enabled?: boolean;
          free_playback?: string;
          id?: string;
          name: string;
          owner_id: string;
          revision?: number;
          spotify_url?: string | null;
          updated_at?: string;
        };
        Update: {
          allowed_origins?: string[];
          apple_url?: string | null;
          artist_id?: string;
          artwork?: string | null;
          audio_url?: string | null;
          created_at?: string;
          created_by?: string;
          enabled?: boolean;
          free_playback?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          revision?: number;
          spotify_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "release_players_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "release_players_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "release_players_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          id: number;
          permission: Database["public"]["Enums"]["app_permissions"];
          role: string;
        };
        Insert: {
          id?: number;
          permission: Database["public"]["Enums"]["app_permissions"];
          role: string;
        };
        Update: {
          id?: number;
          permission?: Database["public"]["Enums"]["app_permissions"];
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["name"];
          },
        ];
      };
      roles: {
        Row: {
          hierarchy_level: number;
          name: string;
        };
        Insert: {
          hierarchy_level: number;
          name: string;
        };
        Update: {
          hierarchy_level?: number;
          name?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          account_id: string | null;
          artist_id: string | null;
          id: string;
          topic: string | null;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          artist_id?: string | null;
          id?: string;
          topic?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          artist_id?: string | null;
          id?: string;
          topic?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_pipeline_customers: {
        Row: {
          activity_count: number | null;
          assigned_to: string | null;
          company_size: string | null;
          competitors: string[] | null;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          contacts: Json | null;
          conversion_stage: string | null;
          conversion_target_date: string | null;
          created_at: string | null;
          current_artists: number;
          current_mrr: number;
          custom_fields: Json | null;
          days_in_stage: number | null;
          domain: string | null;
          email: string | null;
          engagement_health: string | null;
          expected_close_date: string | null;
          external_ids: Json | null;
          id: string;
          industry: string | null;
          internal_owner: string | null;
          last_activity_date: string | null;
          last_activity_type: string | null;
          last_contact_date: string;
          logo_url: string | null;
          lost_reason: string | null;
          name: string;
          next_action: string | null;
          next_activity_date: string | null;
          next_activity_type: string | null;
          notes: string | null;
          order_index: number | null;
          organization: string | null;
          potential_artists: number;
          potential_mrr: number;
          priority: string | null;
          probability: number | null;
          recoupable_user_id: string | null;
          source: string | null;
          stage: string;
          stage_entered_at: string | null;
          tags: string[] | null;
          todos: Json | null;
          trial_end_date: string | null;
          trial_start_date: string | null;
          type: string | null;
          updated_at: string | null;
          use_case_type: string | null;
          website: string | null;
          weighted_mrr: number | null;
          win_reason: string | null;
        };
        Insert: {
          activity_count?: number | null;
          assigned_to?: string | null;
          company_size?: string | null;
          competitors?: string[] | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contacts?: Json | null;
          conversion_stage?: string | null;
          conversion_target_date?: string | null;
          created_at?: string | null;
          current_artists?: number;
          current_mrr?: number;
          custom_fields?: Json | null;
          days_in_stage?: number | null;
          domain?: string | null;
          email?: string | null;
          engagement_health?: string | null;
          expected_close_date?: string | null;
          external_ids?: Json | null;
          id?: string;
          industry?: string | null;
          internal_owner?: string | null;
          last_activity_date?: string | null;
          last_activity_type?: string | null;
          last_contact_date?: string;
          logo_url?: string | null;
          lost_reason?: string | null;
          name: string;
          next_action?: string | null;
          next_activity_date?: string | null;
          next_activity_type?: string | null;
          notes?: string | null;
          order_index?: number | null;
          organization?: string | null;
          potential_artists?: number;
          potential_mrr?: number;
          priority?: string | null;
          probability?: number | null;
          recoupable_user_id?: string | null;
          source?: string | null;
          stage: string;
          stage_entered_at?: string | null;
          tags?: string[] | null;
          todos?: Json | null;
          trial_end_date?: string | null;
          trial_start_date?: string | null;
          type?: string | null;
          updated_at?: string | null;
          use_case_type?: string | null;
          website?: string | null;
          weighted_mrr?: number | null;
          win_reason?: string | null;
        };
        Update: {
          activity_count?: number | null;
          assigned_to?: string | null;
          company_size?: string | null;
          competitors?: string[] | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contacts?: Json | null;
          conversion_stage?: string | null;
          conversion_target_date?: string | null;
          created_at?: string | null;
          current_artists?: number;
          current_mrr?: number;
          custom_fields?: Json | null;
          days_in_stage?: number | null;
          domain?: string | null;
          email?: string | null;
          engagement_health?: string | null;
          expected_close_date?: string | null;
          external_ids?: Json | null;
          id?: string;
          industry?: string | null;
          internal_owner?: string | null;
          last_activity_date?: string | null;
          last_activity_type?: string | null;
          last_contact_date?: string;
          logo_url?: string | null;
          lost_reason?: string | null;
          name?: string;
          next_action?: string | null;
          next_activity_date?: string | null;
          next_activity_type?: string | null;
          notes?: string | null;
          order_index?: number | null;
          organization?: string | null;
          potential_artists?: number;
          potential_mrr?: number;
          priority?: string | null;
          probability?: number | null;
          recoupable_user_id?: string | null;
          source?: string | null;
          stage?: string;
          stage_entered_at?: string | null;
          tags?: string[] | null;
          todos?: Json | null;
          trial_end_date?: string | null;
          trial_start_date?: string | null;
          type?: string | null;
          updated_at?: string | null;
          use_case_type?: string | null;
          website?: string | null;
          weighted_mrr?: number | null;
          win_reason?: string | null;
        };
        Relationships: [];
      };
      save_track: {
        Row: {
          game: string | null;
          id: string | null;
          timestamp: string | null;
        };
        Insert: {
          game?: string | null;
          id?: string | null;
          timestamp?: string | null;
        };
        Update: {
          game?: string | null;
          id?: string | null;
          timestamp?: string | null;
        };
        Relationships: [];
      };
      scheduled_actions: {
        Row: {
          account_id: string;
          artist_account_id: string;
          created_at: string | null;
          enabled: boolean | null;
          id: string;
          model: string | null;
          prompt: string;
          schedule: string;
          title: string;
          trigger_schedule_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          artist_account_id: string;
          created_at?: string | null;
          enabled?: boolean | null;
          id?: string;
          model?: string | null;
          prompt: string;
          schedule: string;
          title: string;
          trigger_schedule_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          artist_account_id?: string;
          created_at?: string | null;
          enabled?: boolean | null;
          id?: string;
          model?: string | null;
          prompt?: string;
          schedule?: string;
          title?: string;
          trigger_schedule_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_actions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_actions_artist_account_id_fkey";
            columns: ["artist_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_posts: {
        Row: {
          account_id: string;
          artist_account_id: string | null;
          cover_url: string | null;
          created_at: string;
          created_by_account_id: string | null;
          description: string | null;
          error_message: string | null;
          id: string;
          platform: string;
          post_url: string | null;
          privacy: string | null;
          publish_at: string | null;
          status: string;
          sub_account_id: string | null;
          tags: string[] | null;
          text_verified: boolean | null;
          title: string | null;
          updated_at: string;
          video_url: string;
          workflow_run_id: string | null;
        };
        Insert: {
          account_id: string;
          artist_account_id?: string | null;
          cover_url?: string | null;
          created_at?: string;
          created_by_account_id?: string | null;
          description?: string | null;
          error_message?: string | null;
          id?: string;
          platform: string;
          post_url?: string | null;
          privacy?: string | null;
          publish_at?: string | null;
          status: string;
          sub_account_id?: string | null;
          tags?: string[] | null;
          text_verified?: boolean | null;
          title?: string | null;
          updated_at?: string;
          video_url: string;
          workflow_run_id?: string | null;
        };
        Update: {
          account_id?: string;
          artist_account_id?: string | null;
          cover_url?: string | null;
          created_at?: string;
          created_by_account_id?: string | null;
          description?: string | null;
          error_message?: string | null;
          id?: string;
          platform?: string;
          post_url?: string | null;
          privacy?: string | null;
          publish_at?: string | null;
          status?: string;
          sub_account_id?: string | null;
          tags?: string[] | null;
          text_verified?: boolean | null;
          title?: string | null;
          updated_at?: string;
          video_url?: string;
          workflow_run_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_posts_artist_account_id_fkey";
            columns: ["artist_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_posts_created_by_account_id_fkey";
            columns: ["created_by_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      segment_rooms: {
        Row: {
          id: string;
          room_id: string;
          segment_id: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          segment_id: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          segment_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "segment_rooms_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "segment_rooms_segment_id_fkey";
            columns: ["segment_id"];
            isOneToOne: false;
            referencedRelation: "segments";
            referencedColumns: ["id"];
          },
        ];
      };
      segments: {
        Row: {
          id: string;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          account_id: string;
          artist_id: string | null;
          branch: string | null;
          cached_diff: Json | null;
          cached_diff_updated_at: string | null;
          clone_url: string | null;
          created_at: string;
          global_skill_refs: Json;
          hibernate_after: string | null;
          id: string;
          is_new_branch: boolean;
          last_activity_at: string | null;
          lifecycle_error: string | null;
          lifecycle_run_id: string | null;
          lifecycle_state: string | null;
          lifecycle_version: number;
          lines_added: number | null;
          lines_removed: number | null;
          repo_name: string | null;
          repo_owner: string | null;
          sandbox_expires_at: string | null;
          sandbox_state: Json | null;
          snapshot_created_at: string | null;
          snapshot_size_bytes: number | null;
          snapshot_url: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          artist_id?: string | null;
          branch?: string | null;
          cached_diff?: Json | null;
          cached_diff_updated_at?: string | null;
          clone_url?: string | null;
          created_at?: string;
          global_skill_refs?: Json;
          hibernate_after?: string | null;
          id: string;
          is_new_branch?: boolean;
          last_activity_at?: string | null;
          lifecycle_error?: string | null;
          lifecycle_run_id?: string | null;
          lifecycle_state?: string | null;
          lifecycle_version?: number;
          lines_added?: number | null;
          lines_removed?: number | null;
          repo_name?: string | null;
          repo_owner?: string | null;
          sandbox_expires_at?: string | null;
          sandbox_state?: Json | null;
          snapshot_created_at?: string | null;
          snapshot_size_bytes?: number | null;
          snapshot_url?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          artist_id?: string | null;
          branch?: string | null;
          cached_diff?: Json | null;
          cached_diff_updated_at?: string | null;
          clone_url?: string | null;
          created_at?: string;
          global_skill_refs?: Json;
          hibernate_after?: string | null;
          id?: string;
          is_new_branch?: boolean;
          last_activity_at?: string | null;
          lifecycle_error?: string | null;
          lifecycle_run_id?: string | null;
          lifecycle_state?: string | null;
          lifecycle_version?: number;
          lines_added?: number | null;
          lines_removed?: number | null;
          repo_name?: string | null;
          repo_owner?: string | null;
          sandbox_expires_at?: string | null;
          sandbox_state?: Json | null;
          snapshot_created_at?: string | null;
          snapshot_size_bytes?: number | null;
          snapshot_url?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      site_activity_events: {
        Row: {
          created_at: string;
          event: string;
          id: string;
          site_id: string;
          visit_id: string;
        };
        Insert: {
          created_at?: string;
          event: string;
          id: string;
          site_id: string;
          visit_id: string;
        };
        Update: {
          created_at?: string;
          event?: string;
          id?: string;
          site_id?: string;
          visit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_activity_events_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      site_fan_configs: {
        Row: {
          enabled: boolean;
          marketing_text: string;
          return_url: string;
          revision: number;
          site_id: string;
          updated_at: string;
        };
        Insert: {
          enabled?: boolean;
          marketing_text: string;
          return_url: string;
          revision?: number;
          site_id: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          marketing_text?: string;
          return_url?: string;
          revision?: number;
          site_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_fan_configs_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: true;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      site_fan_connections: {
        Row: {
          connected_at: string;
          fan_id: string;
          id: string;
          state_hash: string;
        };
        Insert: {
          connected_at?: string;
          fan_id: string;
          id?: string;
          state_hash: string;
        };
        Update: {
          connected_at?: string;
          fan_id?: string;
          id?: string;
          state_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_fan_connections_fan_id_fkey";
            columns: ["fan_id"];
            isOneToOne: false;
            referencedRelation: "site_fans";
            referencedColumns: ["id"];
          },
        ];
      };
      site_fan_marketing_consents: {
        Row: {
          accepted_at: string;
          config_revision: number;
          connection_id: string;
          consent_text: string;
        };
        Insert: {
          accepted_at?: string;
          config_revision: number;
          connection_id: string;
          consent_text: string;
        };
        Update: {
          accepted_at?: string;
          config_revision?: number;
          connection_id?: string;
          consent_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_fan_marketing_consents_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: true;
            referencedRelation: "site_fan_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      site_fan_oauth_sessions: {
        Row: {
          accepted_at: string;
          browser_hash: string;
          config_revision: number;
          consumed_at: string | null;
          expires_at: string;
          marketing_text: string;
          return_url: string;
          scopes: string[];
          site_id: string;
          state_hash: string;
          verifier: string;
        };
        Insert: {
          accepted_at?: string;
          browser_hash: string;
          config_revision: number;
          consumed_at?: string | null;
          expires_at: string;
          marketing_text: string;
          return_url: string;
          scopes: string[];
          site_id: string;
          state_hash: string;
          verifier: string;
        };
        Update: {
          accepted_at?: string;
          browser_hash?: string;
          config_revision?: number;
          consumed_at?: string | null;
          expires_at?: string;
          marketing_text?: string;
          return_url?: string;
          scopes?: string[];
          site_id?: string;
          state_hash?: string;
          verifier?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_fan_oauth_sessions_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      site_fan_permissions: {
        Row: {
          connection_id: string;
          granted_at: string;
          scopes: string[];
        };
        Insert: {
          connection_id: string;
          granted_at?: string;
          scopes: string[];
        };
        Update: {
          connection_id?: string;
          granted_at?: string;
          scopes?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "site_fan_permissions_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: true;
            referencedRelation: "site_fan_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      site_fans: {
        Row: {
          display_name: string | null;
          email: string | null;
          first_connected_at: string;
          id: string;
          last_connected_at: string;
          site_id: string;
          spotify_id: string;
        };
        Insert: {
          display_name?: string | null;
          email?: string | null;
          first_connected_at?: string;
          id?: string;
          last_connected_at?: string;
          site_id: string;
          spotify_id: string;
        };
        Update: {
          display_name?: string | null;
          email?: string | null;
          first_connected_at?: string;
          id?: string;
          last_connected_at?: string;
          site_id?: string;
          spotify_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_fans_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      site_request_windows: {
        Row: {
          key: string;
          requests: number;
          window_start: string;
        };
        Insert: {
          key: string;
          requests: number;
          window_start: string;
        };
        Update: {
          key?: string;
          requests?: number;
          window_start?: string;
        };
        Relationships: [];
      };
      site_signups: {
        Row: {
          consent_text: string;
          created_at: string;
          email: string;
          id: string;
          site_id: string;
        };
        Insert: {
          consent_text: string;
          created_at?: string;
          email: string;
          id?: string;
          site_id: string;
        };
        Update: {
          consent_text?: string;
          created_at?: string;
          email?: string;
          id?: string;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_signups_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      sites: {
        Row: {
          artist_id: string | null;
          assets: Json;
          brief: string;
          created_at: string;
          created_by: string;
          draft: Json | null;
          id: string;
          name: string;
          owner_id: string;
          published: Json | null;
          published_at: string | null;
          release_url: string;
          revision: number;
          updated_at: string;
        };
        Insert: {
          artist_id?: string | null;
          assets?: Json;
          brief?: string;
          created_at?: string;
          created_by: string;
          draft?: Json | null;
          id?: string;
          name: string;
          owner_id: string;
          published?: Json | null;
          published_at?: string | null;
          release_url?: string;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          artist_id?: string | null;
          assets?: Json;
          brief?: string;
          created_at?: string;
          created_by?: string;
          draft?: Json | null;
          id?: string;
          name?: string;
          owner_id?: string;
          published?: Json | null;
          published_at?: string | null;
          release_url?: string;
          revision?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sites_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      social_fans: {
        Row: {
          artist_social_id: string;
          created_at: string;
          fan_social_id: string;
          id: string;
          latest_engagement: string | null;
          latest_engagement_id: string | null;
          updated_at: string;
        };
        Insert: {
          artist_social_id: string;
          created_at?: string;
          fan_social_id: string;
          id?: string;
          latest_engagement?: string | null;
          latest_engagement_id?: string | null;
          updated_at?: string;
        };
        Update: {
          artist_social_id?: string;
          created_at?: string;
          fan_social_id?: string;
          id?: string;
          latest_engagement?: string | null;
          latest_engagement_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_fans_artist_social_id_fkey";
            columns: ["artist_social_id"];
            isOneToOne: false;
            referencedRelation: "socials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_fans_fan_social_id_fkey";
            columns: ["fan_social_id"];
            isOneToOne: false;
            referencedRelation: "socials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_fans_latest_engagement_id_fkey";
            columns: ["latest_engagement_id"];
            isOneToOne: false;
            referencedRelation: "post_comments";
            referencedColumns: ["id"];
          },
        ];
      };
      social_posts: {
        Row: {
          id: string;
          post_id: string | null;
          social_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          post_id?: string | null;
          social_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          post_id?: string | null;
          social_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "social_posts_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_posts_social_id_fkey";
            columns: ["social_id"];
            isOneToOne: false;
            referencedRelation: "socials";
            referencedColumns: ["id"];
          },
        ];
      };
      social_snapshots: {
        Row: {
          captured_at: string;
          captured_on: string;
          follower_count: number;
          following_count: number | null;
          id: string;
          post_count: number | null;
          social_id: string;
        };
        Insert: {
          captured_at?: string;
          captured_on: string;
          follower_count: number;
          following_count?: number | null;
          id?: string;
          post_count?: number | null;
          social_id: string;
        };
        Update: {
          captured_at?: string;
          captured_on?: string;
          follower_count?: number;
          following_count?: number | null;
          id?: string;
          post_count?: number | null;
          social_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_snapshots_social_id_fkey";
            columns: ["social_id"];
            isOneToOne: false;
            referencedRelation: "socials";
            referencedColumns: ["id"];
          },
        ];
      };
      socials: {
        Row: {
          avatar: string | null;
          bio: string | null;
          followerCount: number | null;
          followingCount: number | null;
          id: string;
          profile_url: string;
          region: string | null;
          updated_at: string;
          username: string;
        };
        Insert: {
          avatar?: string | null;
          bio?: string | null;
          followerCount?: number | null;
          followingCount?: number | null;
          id?: string;
          profile_url: string;
          region?: string | null;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar?: string | null;
          bio?: string | null;
          followerCount?: number | null;
          followingCount?: number | null;
          id?: string;
          profile_url?: string;
          region?: string | null;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      song_artists: {
        Row: {
          artist: string;
          created_at: string;
          id: string;
          song: string;
          updated_at: string;
        };
        Insert: {
          artist: string;
          created_at?: string;
          id?: string;
          song: string;
          updated_at?: string;
        };
        Update: {
          artist?: string;
          created_at?: string;
          id?: string;
          song?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "song_artists_artist_fkey";
            columns: ["artist"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_artists_song_fkey";
            columns: ["song"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["isrc"];
          },
        ];
      };
      song_identifiers: {
        Row: {
          created_at: string;
          id: string;
          identifier_type: string;
          platform: string;
          song: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          identifier_type: string;
          platform: string;
          song: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          identifier_type?: string;
          platform?: string;
          song?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "song_identifiers_song_fkey";
            columns: ["song"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["isrc"];
          },
        ];
      };
      song_measurements: {
        Row: {
          captured_at: string;
          created_at: string;
          data_source: string;
          id: string;
          metric: string;
          platform: string;
          raw_ref: string | null;
          snapshot: string | null;
          song: string;
          value: number;
        };
        Insert: {
          captured_at: string;
          created_at?: string;
          data_source: string;
          id?: string;
          metric: string;
          platform: string;
          raw_ref?: string | null;
          snapshot?: string | null;
          song: string;
          value: number;
        };
        Update: {
          captured_at?: string;
          created_at?: string;
          data_source?: string;
          id?: string;
          metric?: string;
          platform?: string;
          raw_ref?: string | null;
          snapshot?: string | null;
          song?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "song_measurements_snapshot_fkey";
            columns: ["snapshot"];
            isOneToOne: false;
            referencedRelation: "playcount_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_measurements_song_fkey";
            columns: ["song"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["isrc"];
          },
        ];
      };
      songs: {
        Row: {
          album: string | null;
          artwork_url: string | null;
          isrc: string;
          name: string | null;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          album?: string | null;
          artwork_url?: string | null;
          isrc: string;
          name?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          album?: string | null;
          artwork_url?: string | null;
          isrc?: string;
          name?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      songstats_backfill_queue: {
        Row: {
          created_at: string;
          id: string;
          rank_score: number;
          song: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          rank_score?: number;
          song: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          rank_score?: number;
          song?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "songstats_backfill_queue_song_fkey";
            columns: ["song"];
            isOneToOne: true;
            referencedRelation: "songs";
            referencedColumns: ["isrc"];
          },
        ];
      };
      spotify: {
        Row: {
          clientId: string | null;
          country: string | null;
          display_name: string | null;
          email: string | null;
          "explicit_content.filter_enabled": string | null;
          "explicit_content.filter_locked": string | null;
          "external_urls.spotify": Json | null;
          fanId: string | null;
          "fanId.country": string | null;
          "fanId.display_name": string | null;
          "fanId.email": string | null;
          "fanId.explicit_content.filter_enabled": string | null;
          "fanId.explicit_content.filter_locked": string | null;
          "fanId.external_urls.spotify": string | null;
          "fanId.followers.total": string | null;
          "fanId.href": string | null;
          "fanId.id": string | null;
          "fanId.images": string | null;
          "fanId.isNewFan": string | null;
          "fanId.playlist": string | null;
          "fanId.presavedData.clientId": string | null;
          "fanId.presavedData.country": string | null;
          "fanId.presavedData.display_name": string | null;
          "fanId.presavedData.email": string | null;
          "fanId.presavedData.explicit_content.filter_enabled": string | null;
          "fanId.presavedData.explicit_content.filter_locked": string | null;
          "fanId.presavedData.external_urls.spotify": string | null;
          "fanId.presavedData.followers.total": string | null;
          "fanId.presavedData.href": string | null;
          "fanId.presavedData.id": string | null;
          "fanId.presavedData.images": string | null;
          "fanId.presavedData.playlist": string | null;
          "fanId.presavedData.product": string | null;
          "fanId.presavedData.recentlyPlayed": string | null;
          "fanId.presavedData.timestamp": string | null;
          "fanId.presavedData.type": string | null;
          "fanId.presavedData.uri": string | null;
          "fanId.product": string | null;
          "fanId.timestamp": string | null;
          "fanId.type": string | null;
          "fanId.uri": string | null;
          "followers.total": Json | null;
          game: string | null;
          href: string | null;
          id: string | null;
          images: Json | null;
          playlist: Json | null;
          product: string | null;
          syncId: string | null;
          timestamp: string | null;
          type: string | null;
          uri: string | null;
        };
        Insert: {
          clientId?: string | null;
          country?: string | null;
          display_name?: string | null;
          email?: string | null;
          "explicit_content.filter_enabled"?: string | null;
          "explicit_content.filter_locked"?: string | null;
          "external_urls.spotify"?: Json | null;
          fanId?: string | null;
          "fanId.country"?: string | null;
          "fanId.display_name"?: string | null;
          "fanId.email"?: string | null;
          "fanId.explicit_content.filter_enabled"?: string | null;
          "fanId.explicit_content.filter_locked"?: string | null;
          "fanId.external_urls.spotify"?: string | null;
          "fanId.followers.total"?: string | null;
          "fanId.href"?: string | null;
          "fanId.id"?: string | null;
          "fanId.images"?: string | null;
          "fanId.isNewFan"?: string | null;
          "fanId.playlist"?: string | null;
          "fanId.presavedData.clientId"?: string | null;
          "fanId.presavedData.country"?: string | null;
          "fanId.presavedData.display_name"?: string | null;
          "fanId.presavedData.email"?: string | null;
          "fanId.presavedData.explicit_content.filter_enabled"?: string | null;
          "fanId.presavedData.explicit_content.filter_locked"?: string | null;
          "fanId.presavedData.external_urls.spotify"?: string | null;
          "fanId.presavedData.followers.total"?: string | null;
          "fanId.presavedData.href"?: string | null;
          "fanId.presavedData.id"?: string | null;
          "fanId.presavedData.images"?: string | null;
          "fanId.presavedData.playlist"?: string | null;
          "fanId.presavedData.product"?: string | null;
          "fanId.presavedData.recentlyPlayed"?: string | null;
          "fanId.presavedData.timestamp"?: string | null;
          "fanId.presavedData.type"?: string | null;
          "fanId.presavedData.uri"?: string | null;
          "fanId.product"?: string | null;
          "fanId.timestamp"?: string | null;
          "fanId.type"?: string | null;
          "fanId.uri"?: string | null;
          "followers.total"?: Json | null;
          game?: string | null;
          href?: string | null;
          id?: string | null;
          images?: Json | null;
          playlist?: Json | null;
          product?: string | null;
          syncId?: string | null;
          timestamp?: string | null;
          type?: string | null;
          uri?: string | null;
        };
        Update: {
          clientId?: string | null;
          country?: string | null;
          display_name?: string | null;
          email?: string | null;
          "explicit_content.filter_enabled"?: string | null;
          "explicit_content.filter_locked"?: string | null;
          "external_urls.spotify"?: Json | null;
          fanId?: string | null;
          "fanId.country"?: string | null;
          "fanId.display_name"?: string | null;
          "fanId.email"?: string | null;
          "fanId.explicit_content.filter_enabled"?: string | null;
          "fanId.explicit_content.filter_locked"?: string | null;
          "fanId.external_urls.spotify"?: string | null;
          "fanId.followers.total"?: string | null;
          "fanId.href"?: string | null;
          "fanId.id"?: string | null;
          "fanId.images"?: string | null;
          "fanId.isNewFan"?: string | null;
          "fanId.playlist"?: string | null;
          "fanId.presavedData.clientId"?: string | null;
          "fanId.presavedData.country"?: string | null;
          "fanId.presavedData.display_name"?: string | null;
          "fanId.presavedData.email"?: string | null;
          "fanId.presavedData.explicit_content.filter_enabled"?: string | null;
          "fanId.presavedData.explicit_content.filter_locked"?: string | null;
          "fanId.presavedData.external_urls.spotify"?: string | null;
          "fanId.presavedData.followers.total"?: string | null;
          "fanId.presavedData.href"?: string | null;
          "fanId.presavedData.id"?: string | null;
          "fanId.presavedData.images"?: string | null;
          "fanId.presavedData.playlist"?: string | null;
          "fanId.presavedData.product"?: string | null;
          "fanId.presavedData.recentlyPlayed"?: string | null;
          "fanId.presavedData.timestamp"?: string | null;
          "fanId.presavedData.type"?: string | null;
          "fanId.presavedData.uri"?: string | null;
          "fanId.product"?: string | null;
          "fanId.timestamp"?: string | null;
          "fanId.type"?: string | null;
          "fanId.uri"?: string | null;
          "followers.total"?: Json | null;
          game?: string | null;
          href?: string | null;
          id?: string | null;
          images?: Json | null;
          playlist?: Json | null;
          product?: string | null;
          syncId?: string | null;
          timestamp?: string | null;
          type?: string | null;
          uri?: string | null;
        };
        Relationships: [];
      };
      spotify_login_button_clicked: {
        Row: {
          campaignId: string | null;
          clientId: string | null;
          fanId: string | null;
          game: string | null;
          id: string | null;
          timestamp: number | null;
        };
        Insert: {
          campaignId?: string | null;
          clientId?: string | null;
          fanId?: string | null;
          game?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Update: {
          campaignId?: string | null;
          clientId?: string | null;
          fanId?: string | null;
          game?: string | null;
          id?: string | null;
          timestamp?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "spotify_login_button_clicked_campaignId_fkey";
            columns: ["campaignId"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      spotify_play_button_clicked: {
        Row: {
          campaignId: string | null;
          clientId: string | null;
          fanId: string | null;
          game: string | null;
          id: string;
          isPremium: boolean | null;
          timestamp: number | null;
        };
        Insert: {
          campaignId?: string | null;
          clientId?: string | null;
          fanId?: string | null;
          game?: string | null;
          id?: string;
          isPremium?: boolean | null;
          timestamp?: number | null;
        };
        Update: {
          campaignId?: string | null;
          clientId?: string | null;
          fanId?: string | null;
          game?: string | null;
          id?: string;
          isPremium?: boolean | null;
          timestamp?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "spotify_play_button_clicked_campaignId_fkey";
            columns: ["campaignId"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "spotify_play_button_clicked_fanId_fkey";
            columns: ["fanId"];
            isOneToOne: false;
            referencedRelation: "fans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_items: {
        Row: {
          created_at: string;
          id: string;
          interval: string;
          interval_count: number;
          price_amount: number | null;
          product_id: string;
          quantity: number;
          subscription_id: string;
          type: Database["public"]["Enums"]["subscription_item_type"];
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          interval: string;
          interval_count: number;
          price_amount?: number | null;
          product_id: string;
          quantity?: number;
          subscription_id: string;
          type: Database["public"]["Enums"]["subscription_item_type"];
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          interval?: string;
          interval_count?: number;
          price_amount?: number | null;
          product_id?: string;
          quantity?: number;
          subscription_id?: string;
          type?: Database["public"]["Enums"]["subscription_item_type"];
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_items_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          account_id: string;
          active: boolean;
          billing_customer_id: number;
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          cancel_at_period_end: boolean;
          created_at: string;
          currency: string;
          id: string;
          period_ends_at: string;
          period_starts_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at: string | null;
          trial_starts_at: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          active: boolean;
          billing_customer_id: number;
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          cancel_at_period_end: boolean;
          created_at?: string;
          currency: string;
          id: string;
          period_ends_at: string;
          period_starts_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          trial_starts_at?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          active?: boolean;
          billing_customer_id?: number;
          billing_provider?: Database["public"]["Enums"]["billing_provider"];
          cancel_at_period_end?: boolean;
          created_at?: string;
          currency?: string;
          id?: string;
          period_ends_at?: string;
          period_starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          trial_starts_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_billing_customer_id_fkey";
            columns: ["billing_customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          account_id: string;
          created_at: string;
          description: string | null;
          done: boolean;
          id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          description?: string | null;
          done?: boolean;
          id?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          description?: string | null;
          done?: boolean;
          id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      test_emails: {
        Row: {
          created_at: string;
          email: string | null;
          id: number;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: number;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: number;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          account_id: string;
          agent_type: string;
          cached_input_tokens: number;
          created_at: string;
          credits_deducted: number;
          id: string;
          input_tokens: number;
          model_id: string | null;
          output_tokens: number;
          provider: string | null;
          resource_url: string | null;
          source: string;
          tool_call_count: number;
        };
        Insert: {
          account_id: string;
          agent_type?: string;
          cached_input_tokens?: number;
          created_at?: string;
          credits_deducted?: number;
          id: string;
          input_tokens?: number;
          model_id?: string | null;
          output_tokens?: number;
          provider?: string | null;
          resource_url?: string | null;
          source?: string;
          tool_call_count?: number;
        };
        Update: {
          account_id?: string;
          agent_type?: string;
          cached_input_tokens?: number;
          created_at?: string;
          credits_deducted?: number;
          id?: string;
          input_tokens?: number;
          model_id?: string | null;
          output_tokens?: number;
          provider?: string | null;
          resource_url?: string | null;
          source?: string;
          tool_call_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "usage_events_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_run_steps: {
        Row: {
          created_at: string;
          duration_ms: number;
          finish_reason: string | null;
          finished_at: string;
          id: string;
          raw_finish_reason: string | null;
          started_at: string;
          step_number: number;
          workflow_run_id: string;
        };
        Insert: {
          created_at?: string;
          duration_ms: number;
          finish_reason?: string | null;
          finished_at: string;
          id: string;
          raw_finish_reason?: string | null;
          started_at: string;
          step_number: number;
          workflow_run_id: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number;
          finish_reason?: string | null;
          finished_at?: string;
          id?: string;
          raw_finish_reason?: string | null;
          started_at?: string;
          step_number?: number;
          workflow_run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_run_steps_workflow_run_id_fkey";
            columns: ["workflow_run_id"];
            isOneToOne: false;
            referencedRelation: "workflow_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_runs: {
        Row: {
          chat_id: string;
          created_at: string;
          finished_at: string;
          id: string;
          model_id: string | null;
          started_at: string;
          status: string;
          total_duration_ms: number;
        };
        Insert: {
          chat_id: string;
          created_at?: string;
          finished_at: string;
          id: string;
          model_id?: string | null;
          started_at: string;
          status: string;
          total_duration_ms: number;
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          finished_at?: string;
          id?: string;
          model_id?: string | null;
          started_at?: string;
          status?: string;
          total_duration_ms?: number;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_runs_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
        ];
      };
      zz_probe_cleanup_20260805: {
        Row: {
          artist_id: string | null;
          captured_at: string;
          created_at: string | null;
          id: string | null;
          organization_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          artist_id?: string | null;
          captured_at?: string;
          created_at?: string | null;
          id?: string | null;
          organization_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          artist_id?: string | null;
          captured_at?: string;
          created_at?: string | null;
          id?: string | null;
          organization_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_context_result: {
        Args: {
          p_document: string;
          p_owner: string;
          p_result: string;
          p_revision: number;
        };
        Returns: boolean;
      };
      accept_invitation: {
        Args: { token: string; user_id: string };
        Returns: string;
      };
      add_invitations_to_account: {
        Args: {
          account_slug: string;
          invitations: Database["public"]["CompositeTypes"]["invitation"][];
        };
        Returns: Database["public"]["Tables"]["invitations"]["Row"][];
      };
      adopt_context_guest: {
        Args: { p_actor: string; p_hash: string; p_owner: string };
        Returns: Json;
      };
      authorize_context_case_actor: {
        Args: { p_actor: string; p_owner: string };
        Returns: undefined;
      };
      can_action_account_member: {
        Args: { target_team_account_id: string; target_user_id: string };
        Returns: boolean;
      };
      claim_catalog_stream_run: {
        Args: { p_catalog_id: string; p_day: string };
        Returns: {
          catalog_id: string;
          coverage: Json;
          created_at: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          revision: string;
          scheduled_day: string;
          since: string;
          status: string;
          until: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "catalog_stream_runs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_context_enrichment: {
        Args: { p_module: Json; p_owner: string; p_request: string };
        Returns: Json;
      };
      claim_context_execution_node: {
        Args: { p_execution: string; p_node_key: string; p_owner: string };
        Returns: Json;
      };
      claim_context_guest_worker: {
        Args: { p_id: string; p_token: string };
        Returns: Json;
      };
      claim_context_release_track_isrcs: {
        Args: {
          p_fingerprint: string;
          p_owner: string;
          p_release_result: string;
          p_request: string;
          p_subject: string;
        };
        Returns: Json;
      };
      claim_context_request: {
        Args: { p_owner: string; p_request: string; p_token: string };
        Returns: boolean;
      };
      claim_songstats_backfill_rows: {
        Args: { batch_size: number };
        Returns: {
          created_at: string;
          id: string;
          rank_score: number;
          song: string;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "songstats_backfill_queue";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      cleanup_site_transient_data: { Args: never; Returns: undefined };
      commit_catalog_stream_track: {
        Args: { p_isrc: string; p_result: Json; p_run_id: string };
        Returns: boolean;
      };
      commit_spotify_context: {
        Args: {
          p_owner: string;
          p_payload: Json;
          p_request: string;
          p_token: string;
        };
        Returns: Json;
      };
      complete_context_enrichment: {
        Args: {
          p_attempt: string;
          p_owner: string;
          p_request: string;
          p_result: Json;
        };
        Returns: Json;
      };
      complete_context_guest: {
        Args: { p_id: string; p_payload: Json; p_token: string };
        Returns: Json;
      };
      complete_context_release_track_isrcs: {
        Args: {
          p_attempt: string;
          p_owner: string;
          p_payload: Json;
          p_release_result: string;
          p_request: string;
          p_subject: string;
        };
        Returns: Json;
      };
      complete_site_fan_connection: {
        Args: {
          p_display_name: string;
          p_email: string;
          p_scopes: string[];
          p_spotify_id: string;
          p_state_hash: string;
        };
        Returns: string;
      };
      confirm_professional_roster: {
        Args: { p_actor: string; p_input: Json; p_key: string; p_org: string };
        Returns: Json;
      };
      connect_player_fan: {
        Args: {
          p_display_name: string;
          p_email: string;
          p_revision: number;
          p_scopes: string[];
          p_session: string;
          p_spotify_id: string;
        };
        Returns: string;
      };
      consume_oauth_rate_limit: {
        Args: { p_keys: string[]; p_limits: number[]; p_namespace: string };
        Returns: number;
      };
      context_guest_worker_scope: {
        Args: { p_id: string; p_token: string };
        Returns: Json;
      };
      correct_context_spotify_release: {
        Args: { p_owner: string; p_request: string; p_subject: string };
        Returns: Json;
      };
      count_reports_by_day: {
        Args: { end_date: string; start_date: string };
        Returns: {
          count: number;
          date_key: string;
        }[];
      };
      count_reports_by_month: {
        Args: { end_date: string; start_date: string };
        Returns: {
          count: number;
          date_key: string;
        }[];
      };
      count_reports_by_week: {
        Args: { end_date: string; start_date: string };
        Returns: {
          count: number;
          date_key: string;
        }[];
      };
      create_artist_with_roster: {
        Args: {
          p_account_id: string;
          p_name: string;
          p_organization_id: string;
        };
        Returns: Json;
      };
      create_catalog_context_request: {
        Args: {
          p_actor: string;
          p_catalog: string;
          p_key: string;
          p_owner: string;
        };
        Returns: Json;
      };
      create_context_artist_request: {
        Args: {
          p_actor: string;
          p_artist: string;
          p_key: string;
          p_owner: string;
        };
        Returns: Json;
      };
      create_context_campaign_brief_request: {
        Args: { p_actor: string; p_brief: Json; p_key: string; p_owner: string };
        Returns: Json;
      };
      create_context_company_name_request: {
        Args: {
          p_actor: string;
          p_key: string;
          p_name: string;
          p_owner: string;
        };
        Returns: Json;
      };
      create_context_execution: {
        Args: {
          p_execution: string;
          p_owner: string;
          p_plan: Json;
          p_policy_version: string;
          p_request: string;
        };
        Returns: Json;
      };
      create_context_release_request: {
        Args: {
          p_actor: string;
          p_album: string;
          p_key: string;
          p_owner: string;
        };
        Returns: Json;
      };
      create_context_request: {
        Args: {
          p_actor: string;
          p_fingerprint: string;
          p_input: Json;
          p_key: string;
          p_owner: string;
          p_track: string;
        };
        Returns: Json;
      };
      create_context_songwriter_name_request: {
        Args: {
          p_actor: string;
          p_key: string;
          p_name: string;
          p_owner: string;
        };
        Returns: Json;
      };
      create_context_supporting_text_request: {
        Args: {
          p_actor: string;
          p_key: string;
          p_owner: string;
          p_text: string;
          p_title: string;
        };
        Returns: Json;
      };
      create_invitation: {
        Args: { account_id: string; email: string; role: string };
        Returns: {
          account_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: number;
          invite_token: string;
          invited_by: string;
          role: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "invitations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      deduct_credits: {
        Args: { account_id: string; amount: number };
        Returns: undefined;
      };
      deduct_credits_with_audit: {
        Args: {
          p_account_id: string;
          p_amount: number;
          p_event: Json;
          p_event_id: string;
        };
        Returns: undefined;
      };
      expand_context_catalog_members: {
        Args: {
          p_after_isrc?: string;
          p_limit?: number;
          p_owner: string;
          p_request: string;
          p_subject: string;
        };
        Returns: Json;
      };
      extract_domain: { Args: { email: string }; Returns: string };
      fail_context_enrichment: {
        Args: { p_attempt: string; p_owner: string };
        Returns: boolean;
      };
      fail_context_guest: {
        Args: { p_id: string; p_token: string };
        Returns: boolean;
      };
      fail_context_request: {
        Args: {
          p_error: string;
          p_owner: string;
          p_request: string;
          p_token: string;
        };
        Returns: boolean;
      };
      get_account_invitations: {
        Args: { account_slug: string };
        Returns: {
          account_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: number;
          invited_by: string;
          inviter_email: string;
          inviter_name: string;
          role: string;
          updated_at: string;
        }[];
      };
      get_account_members: {
        Args: { account_slug: string };
        Returns: {
          account_id: string;
          created_at: string;
          email: string;
          id: string;
          name: string;
          picture_url: string;
          primary_owner_user_id: string;
          role: string;
          role_hierarchy_level: number;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_campaign:
        | { Args: { clientid: string }; Returns: Json }
        | {
            Args: { artistid: string; campaignid: string; email: string };
            Returns: Json;
          };
      get_campaign_fans: {
        Args: { artistid: string; email: string };
        Returns: Json;
      };
      get_catalog_measurements_aggregate: {
        Args: { p_artist?: string; p_catalog: string };
        Returns: {
          measured_song_count: number;
          total_streams: number;
        }[];
      };
      get_catalog_measurements_page: {
        Args: {
          p_artist?: string;
          p_catalog: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          isrc: string;
          measured_at: string;
          playcount: number;
          title: string;
        }[];
      };
      get_config: { Args: never; Returns: Json };
      get_credit_spend_digest: {
        Args: { p_limit?: number; p_since: string };
        Returns: Json;
      };
      get_fans_listening_top_songs: {
        Args: { artistid: string; email: string };
        Returns: Json;
      };
      get_message_counts_by_user:
        | {
            Args: { start_date: string };
            Returns: {
              account_email: string;
              message_count: number;
            }[];
          }
        | {
            Args: { end_date: string; start_date: string };
            Returns: {
              account_email: string;
              message_count: number;
            }[];
          };
      get_rooms_created_by_user: {
        Args: { start_date: string };
        Returns: {
          account_email: string;
          rooms_created: number;
        }[];
      };
      get_segment_reports_by_user: {
        Args: { start_date: string };
        Returns: {
          email: string;
          segment_report_count: number;
        }[];
      };
      get_upper_system_role: { Args: never; Returns: string };
      grant_credits_with_audit: {
        Args: {
          p_account_id: string;
          p_granted_by: string;
          p_reason: string;
          p_remaining_credits: number;
        };
        Returns: {
          account_id: string;
          created_at: string;
          granted_by: string;
          id: string;
          previous_credits: number | null;
          reason: string;
          remaining_credits: number;
        };
        SetofOptions: {
          from: "*";
          to: "credit_grants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      has_active_subscription: {
        Args: { target_account_id: string };
        Returns: boolean;
      };
      has_credits: { Args: { account_id: string }; Returns: boolean };
      has_more_elevated_role: {
        Args: {
          role_name: string;
          target_account_id: string;
          target_user_id: string;
        };
        Returns: boolean;
      };
      has_permission: {
        Args: {
          account_id: string;
          permission_name: Database["public"]["Enums"]["app_permissions"];
          user_id: string;
        };
        Returns: boolean;
      };
      has_role_on_account: {
        Args: { account_id: string; account_role?: string };
        Returns: boolean;
      };
      has_same_role_hierarchy_level: {
        Args: {
          role_name: string;
          target_account_id: string;
          target_user_id: string;
        };
        Returns: boolean;
      };
      is_account_owner: { Args: { account_id: string }; Returns: boolean };
      is_account_team_member: {
        Args: { target_account_id: string };
        Returns: boolean;
      };
      is_set: { Args: { field_name: string }; Returns: boolean };
      is_team_member: {
        Args: { account_id: string; user_id: string };
        Returns: boolean;
      };
      list_context_artist_request_target: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      list_context_campaign_request_target: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      list_context_catalog_member_targets: {
        Args: {
          p_after_isrc?: string;
          p_limit?: number;
          p_owner: string;
          p_request: string;
          p_subject: string;
        };
        Returns: Json;
      };
      list_context_catalog_members: {
        Args: {
          p_after_isrc?: string;
          p_limit?: number;
          p_owner: string;
          p_request: string;
          p_subject: string;
        };
        Returns: Json;
      };
      list_context_company_request_target: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      list_context_material_request_target: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      list_context_release_cases: {
        Args: { p_actor: string; p_after?: string; p_owner: string };
        Returns: Json;
      };
      list_context_release_request_target: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      list_context_release_track_slots: {
        Args: {
          p_after_slot?: number;
          p_limit?: number;
          p_owner: string;
          p_request: string;
          p_subject: string;
        };
        Returns: Json;
      };
      list_context_request_executions: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      list_context_request_targets: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      list_context_songwriter_request_target: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      list_professional_roster: {
        Args: { p_actor: string; p_after?: string; p_org: string };
        Returns: Json;
      };
      oauth_store_consume: {
        Args: { p_id_hash: string; p_model: string; p_namespace: string };
        Returns: boolean;
      };
      oauth_store_destroy: {
        Args: { p_id_hash: string; p_model: string; p_namespace: string };
        Returns: undefined;
      };
      oauth_store_find: {
        Args: {
          p_hash: string;
          p_index: string;
          p_model: string;
          p_namespace: string;
        };
        Returns: Json;
      };
      oauth_store_list_connections: {
        Args: { p_account_hash: string; p_namespace: string };
        Returns: Json;
      };
      oauth_store_revoke_grant: {
        Args: { p_grant_hash: string; p_namespace: string };
        Returns: undefined;
      };
      oauth_store_upsert: {
        Args: {
          p_account_hash?: string;
          p_expires_in: number;
          p_grant_hash: string;
          p_id_hash: string;
          p_model: string;
          p_namespace: string;
          p_payload: string;
          p_uid_hash: string;
          p_user_code_hash: string;
        };
        Returns: undefined;
      };
      onboard_spotify_artist: {
        Args: {
          p_account_id: string;
          p_name: string;
          p_organization_id: string;
          p_spotify_artist_id: string;
        };
        Returns: {
          artist_id: string;
          created: boolean;
        }[];
      };
      purge_expired_context_guests: { Args: never; Returns: number };
      read_catalog_stream_days: {
        Args: {
          p_catalog_id: string;
          p_isrc: string;
          p_since: string;
          p_until: string;
        };
        Returns: {
          catalog_id: string;
          date: string;
          isrc: string;
          provider_recording_id: string;
          retrieved_at: string;
          run_id: string;
          source_hash: string;
          streams: number | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "catalog_stream_observations";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      read_context_brief: {
        Args: { p_brief: string; p_owner: string };
        Returns: Json;
      };
      read_context_documents: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      read_context_execution: {
        Args: { p_execution: string; p_owner: string };
        Returns: Json;
      };
      read_context_guest: { Args: { p_hash: string }; Returns: Json };
      read_context_release_case: {
        Args: { p_actor: string; p_owner: string; p_request: string };
        Returns: Json;
      };
      read_context_release_case_review: {
        Args: { p_actor: string; p_owner: string; p_review: string };
        Returns: Json;
      };
      read_context_request: {
        Args: { p_owner: string; p_request: string };
        Returns: Json;
      };
      read_player_report: {
        Args: { p_offset?: number; p_owner: string; p_player: string };
        Returns: Json;
      };
      record_credit_charge_once: {
        Args: {
          p_account_id: string;
          p_amount: number;
          p_event: Json;
          p_operation_key: string;
        };
        Returns: Json;
      };
      record_player_listening: {
        Args: {
          p_event: string;
          p_id: string;
          p_listened: number;
          p_position: number;
          p_provider: string;
          p_revision: number;
          p_session: string;
          p_track: string;
        };
        Returns: boolean;
      };
      resolve_context_artist: {
        Args: { p_owner: string; p_request: string; p_subject: string };
        Returns: Json;
      };
      resolve_context_catalog: {
        Args: { p_owner: string; p_request: string; p_subject: string };
        Returns: Json;
      };
      resolve_context_catalog_member_recording: {
        Args: { p_owner: string; p_recording: string; p_request: string };
        Returns: Json;
      };
      resolve_context_recording_isrc: {
        Args: { p_owner: string; p_request: string; p_subject: string };
        Returns: Json;
      };
      resolve_context_songstats_lookup: {
        Args: {
          p_identifier: string;
          p_kind: string;
          p_owner: string;
          p_request: string;
          p_subject: string;
        };
        Returns: Json;
      };
      resolve_context_spotify_release: {
        Args: { p_owner: string; p_request: string; p_subject: string };
        Returns: Json;
      };
      resolve_oauth_account: {
        Args: {
          p_app_id: string;
          p_subject: string;
          p_verified_emails: string[];
        };
        Returns: string;
      };
      review_context_release_case: {
        Args: {
          p_actor: string;
          p_decision: string;
          p_fingerprint: string;
          p_key: string;
          p_note: string;
          p_owner: string;
          p_request: string;
        };
        Returns: Json;
      };
      review_context_release_track_identities: {
        Args: { p_owner: string; p_request: string; p_subject: string };
        Returns: Json;
      };
      save_context_brief: {
        Args: { p_key: string; p_owner: string; p_snapshot: Json };
        Returns: Json;
      };
      save_context_execution_outcome: {
        Args: {
          p_execution: string;
          p_node_key: string;
          p_outcome: Json;
          p_owner: string;
        };
        Returns: Json;
      };
      save_context_metadata: {
        Args: {
          p_captured?: string;
          p_content: Json;
          p_owner: string;
          p_request: string;
          p_subject: string;
          p_topic: string;
          p_url: string;
        };
        Returns: string;
      };
      save_context_spotify_release_track_slots: {
        Args: {
          p_owner: string;
          p_request: string;
          p_result: string;
          p_subject: string;
        };
        Returns: Json;
      };
      site_activity_summary: { Args: { p_site_id: string }; Returns: Json };
      start_context_guest: {
        Args: {
          p_daily_limit: number;
          p_fingerprint: string;
          p_hash: string;
          p_input: Json;
        };
        Returns: Json;
      };
      take_site_request: {
        Args: { p_key: string; p_limit: number };
        Returns: boolean;
      };
      team_account_workspace: {
        Args: { account_slug: string };
        Returns: {
          id: string;
          name: string;
          permissions: Database["public"]["Enums"]["app_permissions"][];
          picture_url: string;
          primary_owner_user_id: string;
          role: string;
          role_hierarchy_level: number;
          slug: string;
          subscription_status: Database["public"]["Enums"]["subscription_status"];
        }[];
      };
      transfer_team_account_ownership: {
        Args: { new_owner_id: string; target_account_id: string };
        Returns: undefined;
      };
      upsert_order: {
        Args: {
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          currency: string;
          line_items: Json;
          status: Database["public"]["Enums"]["payment_status"];
          target_account_id: string;
          target_customer_id: string;
          target_order_id: string;
          total_amount: number;
        };
        Returns: {
          account_id: string;
          billing_customer_id: number;
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          created_at: string;
          currency: string;
          id: string;
          status: Database["public"]["Enums"]["payment_status"];
          total_amount: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_subscription: {
        Args: {
          active: boolean;
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          cancel_at_period_end: boolean;
          currency: string;
          line_items: Json;
          period_ends_at: string;
          period_starts_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          target_account_id: string;
          target_customer_id: string;
          target_subscription_id: string;
          trial_ends_at?: string;
          trial_starts_at?: string;
        };
        Returns: {
          account_id: string;
          active: boolean;
          billing_customer_id: number;
          billing_provider: Database["public"]["Enums"]["billing_provider"];
          cancel_at_period_end: boolean;
          created_at: string;
          currency: string;
          id: string;
          period_ends_at: string;
          period_starts_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at: string | null;
          trial_starts_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      withdraw_context_source: {
        Args: { p_owner: string; p_source: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_permissions:
        | "roles.manage"
        | "billing.manage"
        | "settings.manage"
        | "members.manage"
        | "invites.manage"
        | "tasks.write"
        | "tasks.delete";
      billing_provider: "stripe" | "lemon-squeezy" | "paddle";
      chat_role: "user" | "assistant";
      notification_channel: "in_app" | "email";
      notification_type: "info" | "warning" | "error";
      payment_status: "pending" | "succeeded" | "failed";
      social_type: "TIKTOK" | "YOUTUBE" | "INSTAGRAM" | "TWITTER" | "SPOTIFY" | "APPLE";
      subscription_item_type: "flat" | "per_seat" | "metered";
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused";
    };
    CompositeTypes: {
      invitation: {
        email: string | null;
        role: string | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
      app_permissions: [
        "roles.manage",
        "billing.manage",
        "settings.manage",
        "members.manage",
        "invites.manage",
        "tasks.write",
        "tasks.delete",
      ],
      billing_provider: ["stripe", "lemon-squeezy", "paddle"],
      chat_role: ["user", "assistant"],
      notification_channel: ["in_app", "email"],
      notification_type: ["info", "warning", "error"],
      payment_status: ["pending", "succeeded", "failed"],
      social_type: ["TIKTOK", "YOUTUBE", "INSTAGRAM", "TWITTER", "SPOTIFY", "APPLE"],
      subscription_item_type: ["flat", "per_seat", "metered"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
    },
  },
} as const;
