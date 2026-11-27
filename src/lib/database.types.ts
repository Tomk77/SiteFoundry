export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      content_fields: {
        Row: {
          id: string;
          content_type_id: string;
          site_language_id: string;
          key: string;
          label: string;
          field_type: string;
          position: number;
          is_primary: boolean;
          is_required: boolean;
          options: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_type_id: string;
          site_language_id: string;
          key: string;
          label: string;
          field_type: string;
          position?: number;
          is_primary?: boolean;
          is_required?: boolean;
          options?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_fields"]["Insert"]>;
        Relationships: [];
      };
      content_records: {
        Row: {
          id: string;
          content_type_id: string;
          site_language_id: string;
          status: string;
          values: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          published_revision_id: string | null;
        };
        Insert: {
          id?: string;
          content_type_id: string;
          site_language_id: string;
          status?: string;
          values?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          published_revision_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["content_records"]["Insert"]>;
        Relationships: [];
      };
      content_types: {
        Row: {
          id: string;
          site_language_id: string;
          slug: string;
          name: string;
          singular_name: string;
          icon: string;
          chip_bg: string;
          chip_fg: string;
          description: string;
          position: number;
          created_at: string;
          updated_at: string;
          published_schema: Json | null;
          published_schema_version: number;
          schema_published_at: string | null;
        };
        Insert: {
          id?: string;
          site_language_id: string;
          slug: string;
          name: string;
          singular_name: string;
          icon?: string;
          chip_bg?: string;
          chip_fg?: string;
          description?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
          published_schema?: Json | null;
          published_schema_version?: number;
          schema_published_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["content_types"]["Insert"]>;
        Relationships: [];
      };
      navigation_menus: {
        Row: {
          id: string;
          site_language_id: string;
          location: string;
          draft_items: Json;
          published_items: Json;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          site_language_id: string;
          location: string;
          draft_items?: Json;
          published_items?: Json;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["navigation_menus"]["Insert"]>;
        Relationships: [];
      };
      pages: {
        Row: {
          content_blocks: unknown;
          concept_revision_id: string | null;
          created_at: string;
          created_from_template_id: string | null;
          created_from_template_key: string | null;
          id: string;
          is_homepage: boolean;
          parent_id: string | null;
          position: number;
          preferred_child_template: string | null;
          published_revision_id: string | null;
          seo_description: string;
          seo_title: string;
          site_language_id: string;
          slug: string;
          social_image: string | null;
          status: string;
          template_name: string;
          title: string;
          updated_at: string;
          validation_status: string;
        };
        Insert: {
          content_blocks?: unknown;
          concept_revision_id?: string | null;
          created_from_template_id?: string | null;
          created_from_template_key?: string | null;
          id?: string;
          site_language_id: string;
          parent_id?: string | null;
          title: string;
          slug?: string;
          template_name?: string;
          status?: string;
          validation_status?: string;
          position?: number;
          preferred_child_template?: string | null;
          published_revision_id?: string | null;
          seo_description?: string;
          seo_title?: string;
          is_homepage?: boolean;
          social_image?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pages"]["Insert"]>;
        Relationships: [];
      };
      page_template_revisions: {
        Row: {
          id: string;
          template_id: string;
          version: number;
          snapshot: Json;
          note: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          version: number;
          snapshot: Json;
          note?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["page_template_revisions"]["Insert"]>;
        Relationships: [];
      };
      page_published_revisions: {
        Row: {
          id: string;
          page_id: string;
          site_language_id: string;
          version: number;
          snapshot: Json;
          published_by: string | null;
          published_at: string;
          source_concept_revision_id: string | null;
        };
        Insert: {
          id?: string;
          page_id: string;
          site_language_id: string;
          version: number;
          snapshot: Json;
          published_by?: string | null;
          published_at?: string;
          source_concept_revision_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["page_published_revisions"]["Insert"]>;
        Relationships: [];
      };
      page_revisions: {
        Row: {
          id: string;
          page_id: string;
          site_language_id: string;
          version: number;
          snapshot: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          page_id: string;
          site_language_id: string;
          version: number;
          snapshot: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["page_revisions"]["Insert"]>;
        Relationships: [];
      };
      content_record_published_revisions: {
        Row: {
          id: string;
          record_id: string;
          content_type_id: string;
          site_language_id: string;
          version: number;
          snapshot: Json;
          published_by: string | null;
          published_at: string;
        };
        Insert: {
          id?: string;
          record_id: string;
          content_type_id: string;
          site_language_id: string;
          version: number;
          snapshot: Json;
          published_by?: string | null;
          published_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["content_record_published_revisions"]["Insert"]
        >;
        Relationships: [];
      };
      page_templates: {
        Row: {
          id: string;
          site_language_id: string;
          key: string;
          name: string;
          description: string;
          icon: string;
          status: string;
          is_fallback: boolean;
          defaults: Json;
          preview_path: string;
          components: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_language_id: string;
          key: string;
          name: string;
          description?: string;
          icon?: string;
          status?: string;
          is_fallback?: boolean;
          defaults?: Json;
          preview_path?: string;
          components?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["page_templates"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          display_name: string | null;
          interface_language: string;
          interface_mode: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          interface_language?: string;
          interface_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      redirects: {
        Row: {
          id: string;
          site_language_id: string;
          page_id: string | null;
          source_path: string;
          destination_path: string;
          status_code: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_language_id: string;
          page_id?: string | null;
          source_path: string;
          destination_path: string;
          status_code?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["redirects"]["Insert"]>;
        Relationships: [];
      };
      site_languages: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          is_default: boolean;
          name: string;
          position: number;
          site_id: string;
          updated_at: string;
          url_prefix: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          code: string;
          name: string;
          is_default?: boolean;
          position?: number;
          url_prefix?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_languages"]["Insert"]>;
        Relationships: [];
      };
      site_members: {
        Row: {
          access_scope: string;
          branch_ids: string[];
          site_id: string;
          user_id: string;
          role: string;
          language_ids: string[];
          sections: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          access_scope?: string;
          branch_ids?: string[];
          site_id: string;
          user_id: string;
          role?: string;
          language_ids?: string[];
          sections?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_members"]["Insert"]>;
        Relationships: [];
      };
      site_invitations: {
        Row: {
          access_scope: string;
          branch_ids: string[];
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          language_ids: string[];
          role: string;
          sections: string[];
          site_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          access_scope?: string;
          branch_ids?: string[];
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          language_ids?: string[];
          role: string;
          sections?: string[];
          site_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_invitations"]["Insert"]>;
        Relationships: [];
      };
      site_domains: {
        Row: {
          created_at: string;
          hostname: string;
          id: string;
          is_primary: boolean;
          site_id: string;
          status: string;
          updated_at: string;
          verification_message: string;
        };
        Insert: {
          created_at?: string;
          hostname: string;
          id?: string;
          is_primary?: boolean;
          site_id: string;
          status?: string;
          updated_at?: string;
          verification_message?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_domains"]["Insert"]>;
        Relationships: [];
      };
      site_export_requests: {
        Row: {
          completed_at: string | null;
          created_at: string;
          download_path: string | null;
          error_message: string | null;
          id: string;
          requested_by: string;
          site_id: string;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          download_path?: string | null;
          error_message?: string | null;
          id?: string;
          requested_by?: string;
          site_id: string;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_export_requests"]["Insert"]>;
        Relationships: [];
      };
      site_api_tokens: {
        Row: {
          id: string;
          site_id: string;
          name: string;
          token_hash: string;
          token_prefix: string;
          token_suffix: string;
          scopes: string[];
          allowed_origins: string[];
          expires_at: string | null;
          last_used_at: string | null;
          revoked_at: string | null;
          rate_limit_per_minute: number;
          rate_window_started_at: string;
          rate_request_count: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          name: string;
          token_hash: string;
          token_prefix: string;
          token_suffix: string;
          scopes?: string[];
          allowed_origins?: string[];
          expires_at?: string | null;
          last_used_at?: string | null;
          revoked_at?: string | null;
          rate_limit_per_minute?: number;
          rate_window_started_at?: string;
          rate_request_count?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_api_tokens"]["Insert"]>;
        Relationships: [];
      };
      sites: {
        Row: {
          created_at: string;
          id: string;
          icon_url: string | null;
          name: string;
          owner_id: string;
          preview_url: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          icon_url?: string | null;
          name: string;
          owner_id: string;
          preview_url?: string;
          slug: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sites"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_site_api_token: {
        Args: {
          target_site_id: string;
          target_name: string;
          target_allowed_origins?: string[];
          target_expires_at?: string | null;
        };
        Returns: Json;
      };
      revoke_site_api_token: {
        Args: { target_token_id: string };
        Returns: undefined;
      };
      get_delivery_bundle: {
        Args: {
          target_site_key: string;
          target_token_hash: string;
          target_origin?: string | null;
        };
        Returns: Json;
      };
      delete_page_template: {
        Args: { target_language_id: string; target_template_id: string };
        Returns: undefined;
      };
      get_page_template_workspace: {
        Args: { target_language_id: string };
        Returns: Json;
      };
      get_site_settings_workspace: {
        Args: { target_site_id?: string | null };
        Returns: Json;
      };
      move_page: {
        Args: {
          moving_page_id: string;
          target_page_id: string;
          drop_position: string;
          create_redirects: boolean;
        };
        Returns: unknown;
      };
      publish_page: {
        Args: { target_page_id: string };
        Returns: string;
      };
      discard_page_concept: {
        Args: { target_page_id: string };
        Returns: string;
      };
      save_page_revision: {
        Args: {
          target_page_id: string;
          expected_concept_revision_id: string | null;
          target_title: string;
          target_slug: string;
          target_content_blocks: Json;
          target_seo_title: string;
          target_seo_description: string;
          target_social_image: string | null;
          target_preferred_child_template: string | null;
          target_validation_status: string;
          should_publish: boolean;
        };
        Returns: Json;
      };
      publish_content_type_schema: {
        Args: { target_content_type_id: string };
        Returns: number;
      };
      save_content_type: {
        Args: {
          target_language_id: string;
          target_type_id: string | null;
          target_slug: string;
          target_name: string;
          target_singular_name: string;
          target_icon: string;
          target_description: string;
          target_fields: Json;
        };
        Returns: string;
      };
      save_page_template: {
        Args: {
          target_language_id: string;
          target_template_id: string | null;
          target_key: string;
          target_name: string;
          target_description: string;
          target_icon: string;
          target_status: string;
          target_is_fallback: boolean;
          target_defaults: Json;
          target_preview_path: string;
          target_components: Json;
        };
        Returns: string;
      };
      set_fallback_page_template: {
        Args: { target_language_id: string; target_template_id: string };
        Returns: undefined;
      };
      set_default_site_language: {
        Args: { target_site_id: string; target_language_id: string };
        Returns: undefined;
      };
      set_primary_site_domain: {
        Args: { target_site_id: string; target_domain_id: string };
        Returns: undefined;
      };
      transfer_site_ownership: {
        Args: { target_site_id: string; target_user_id: string };
        Returns: undefined;
      };
      update_site_member_access: {
        Args: {
          target_access_scope: string;
          target_branch_ids: string[];
          target_language_ids: string[];
          target_role: string;
          target_sections: string[];
          target_site_id: string;
          target_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type PageRow = Database["public"]["Tables"]["pages"]["Row"];
