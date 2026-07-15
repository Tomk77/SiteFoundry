export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
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
        Update: Partial<
          Database["public"]["Tables"]["navigation_menus"]["Insert"]
        >;
        Relationships: [];
      };
      pages: {
        Row: {
          content_blocks: unknown;
          created_at: string;
          id: string;
          is_homepage: boolean;
          parent_id: string | null;
          position: number;
          preferred_child_template: string | null;
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
        };
        Insert: {
          id?: string;
          site_id: string;
          code: string;
          name: string;
          is_default?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["site_languages"]["Insert"]
        >;
        Relationships: [];
      };
      site_members: {
        Row: {
          site_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          site_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: { role?: string };
        Relationships: [];
      };
      sites: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { name?: string; slug?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      move_page: {
        Args: {
          moving_page_id: string;
          target_page_id: string;
          drop_position: string;
          create_redirects: boolean;
        };
        Returns: unknown;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PageRow = Database["public"]["Tables"]["pages"]["Row"];
