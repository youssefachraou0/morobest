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
  public: {
    Tables: {
      collection_items: {
        Row: {
          collection_id: string
          ord: number
          title_id: string
        }
        Insert: {
          collection_id: string
          ord?: number
          title_id: string
        }
        Update: {
          collection_id?: string
          ord?: number
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_url: string | null
          description_en: string | null
          id: string
          name_ar: string
          name_en: string
          name_fr: string
          ord: number
          slug: string
        }
        Insert: {
          cover_url?: string | null
          description_en?: string | null
          id?: string
          name_ar: string
          name_en: string
          name_fr: string
          ord?: number
          slug: string
        }
        Update: {
          cover_url?: string | null
          description_en?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          name_fr?: string
          ord?: number
          slug?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          is_arab: boolean
          name_ar: string
          name_en: string
          name_fr: string
          region: string | null
          slug: string
        }
        Insert: {
          code: string
          is_arab?: boolean
          name_ar: string
          name_en: string
          name_fr: string
          region?: string | null
          slug: string
        }
        Update: {
          code?: string
          is_arab?: boolean
          name_ar?: string
          name_en?: string
          name_fr?: string
          region?: string | null
          slug?: string
        }
        Relationships: []
      }
      credits: {
        Row: {
          character_name: string | null
          id: string
          ord: number
          person_id: string
          role: string
          title_id: string
        }
        Insert: {
          character_name?: string | null
          id?: string
          ord?: number
          person_id: string
          role: string
          title_id: string
        }
        Update: {
          character_name?: string | null
          id?: string
          ord?: number
          person_id?: string
          role?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          air_date: string | null
          id: string
          number: number
          runtime_min: number | null
          season_id: string
          synopsis: string | null
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          air_date?: string | null
          id?: string
          number: number
          runtime_min?: number | null
          season_id: string
          synopsis?: string | null
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          air_date?: string | null
          id?: string
          number?: number
          runtime_min?: number | null
          season_id?: string
          synopsis?: string | null
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          profile_id: string
          title_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          title_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          name_fr: string
          slug: string
        }
        Insert: {
          id?: string
          name_ar: string
          name_en: string
          name_fr: string
          slug: string
        }
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          name_fr?: string
          slug?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          name_ar: string
          name_en: string
          name_fr: string
        }
        Insert: {
          code: string
          name_ar: string
          name_en: string
          name_fr: string
        }
        Update: {
          code?: string
          name_ar?: string
          name_en?: string
          name_fr?: string
        }
        Relationships: []
      }
      manga_chapters: {
        Row: {
          id: string
          number: number
          official_url: string | null
          readable: boolean
          release_date: string | null
          title: string | null
          title_id: string
          volume_id: string | null
        }
        Insert: {
          id?: string
          number: number
          official_url?: string | null
          readable?: boolean
          release_date?: string | null
          title?: string | null
          title_id: string
          volume_id?: string | null
        }
        Update: {
          id?: string
          number?: number
          official_url?: string | null
          readable?: boolean
          release_date?: string | null
          title?: string | null
          title_id?: string
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manga_chapters_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manga_chapters_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "manga_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      manga_volumes: {
        Row: {
          cover_url: string | null
          id: string
          number: number
          release_date: string | null
          title_id: string
        }
        Insert: {
          cover_url?: string | null
          id?: string
          number: number
          release_date?: string | null
          title_id: string
        }
        Update: {
          cover_url?: string | null
          id?: string
          number?: number
          release_date?: string | null
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manga_volumes_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          name: string
          name_ar: string | null
          photo_url: string | null
          slug: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          name_ar?: string | null
          photo_url?: string | null
          slug: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          name_ar?: string | null
          photo_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      playback_progress: {
        Row: {
          completed: boolean
          duration_s: number
          episode_id: string | null
          id: string
          position_s: number
          profile_id: string
          title_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          duration_s?: number
          episode_id?: string | null
          id?: string
          position_s?: number
          profile_id: string
          title_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          duration_s?: number
          episode_id?: string | null
          id?: string
          position_s?: number
          profile_id?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playback_progress_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_progress_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string
          created_at: string
          display_name: string
          id: string
          is_kids: boolean
          locale: string
          max_age: number
          subtitle_lang: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar?: string
          created_at?: string
          display_name: string
          id?: string
          is_kids?: boolean
          locale?: string
          max_age?: number
          subtitle_lang?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar?: string
          created_at?: string
          display_name?: string
          id?: string
          is_kids?: boolean
          locale?: string
          max_age?: number
          subtitle_lang?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_cache: {
        Row: {
          expires_at: string
          key: string
          payload: Json
          updated_at: string
        }
        Insert: {
          expires_at: string
          key: string
          payload: Json
          updated_at?: string
        }
        Update: {
          expires_at?: string
          key?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ramadan_entries: {
        Row: {
          air_time: string | null
          season_id: string
          status: string
          title_id: string
        }
        Insert: {
          air_time?: string | null
          season_id: string
          status?: string
          title_id: string
        }
        Update: {
          air_time?: string | null
          season_id?: string
          status?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ramadan_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "ramadan_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ramadan_entries_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      ramadan_seasons: {
        Row: {
          ends_on: string
          id: string
          is_current: boolean
          starts_on: string
          year: number
        }
        Insert: {
          ends_on: string
          id?: string
          is_current?: boolean
          starts_on: string
          year: number
        }
        Update: {
          ends_on?: string
          id?: string
          is_current?: boolean
          starts_on?: string
          year?: number
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          profile_id: string
          score: number
          title_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          score: number
          title_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          score?: number
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          id: string
          name: string | null
          number: number
          title_id: string
          year: number | null
        }
        Insert: {
          id?: string
          name?: string | null
          number: number
          title_id: string
          year?: number | null
        }
        Update: {
          id?: string
          name?: string | null
          number?: number
          title_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          id: string
          kind: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          kind?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      subtitle_tracks: {
        Row: {
          id: string
          label: string
          lang: string
          url: string
          video_source_id: string
        }
        Insert: {
          id?: string
          label: string
          lang: string
          url: string
          video_source_id: string
        }
        Update: {
          id?: string
          label?: string
          lang?: string
          url?: string
          video_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtitle_tracks_video_source_id_fkey"
            columns: ["video_source_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      title_countries: {
        Row: {
          country_code: string
          title_id: string
        }
        Insert: {
          country_code: string
          title_id: string
        }
        Update: {
          country_code?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_countries_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "title_countries_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_genres: {
        Row: {
          genre_id: string
          title_id: string
        }
        Insert: {
          genre_id: string
          title_id: string
        }
        Update: {
          genre_id?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_genres_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_languages: {
        Row: {
          kind: string
          language_code: string
          title_id: string
        }
        Insert: {
          kind?: string
          language_code: string
          title_id: string
        }
        Update: {
          kind?: string
          language_code?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_languages_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "title_languages_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_relations: {
        Row: {
          from_id: string
          relation: string
          to_id: string
        }
        Insert: {
          from_id: string
          relation: string
          to_id: string
        }
        Update: {
          from_id?: string
          relation?: string
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_relations_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_relations_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_translations: {
        Row: {
          locale: string
          synopsis: string | null
          tagline: string | null
          title: string
          title_id: string
        }
        Insert: {
          locale: string
          synopsis?: string | null
          tagline?: string | null
          title: string
          title_id: string
        }
        Update: {
          locale?: string
          synopsis?: string | null
          tagline?: string | null
          title?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_translations_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      titles: {
        Row: {
          age_rating: number
          backdrop_url: string | null
          created_at: string
          deleted_at: string | null
          format: string | null
          id: string
          is_classic: boolean
          is_kids: boolean
          kind: Database["public"]["Enums"]["title_kind"]
          original_title: string
          popularity: number
          poster_url: string | null
          published: boolean
          rating: number | null
          release_date: string | null
          runtime_min: number | null
          slug: string
          status: string
          studio_id: string | null
          trailer_url: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          age_rating?: number
          backdrop_url?: string | null
          created_at?: string
          deleted_at?: string | null
          format?: string | null
          id?: string
          is_classic?: boolean
          is_kids?: boolean
          kind: Database["public"]["Enums"]["title_kind"]
          original_title: string
          popularity?: number
          poster_url?: string | null
          published?: boolean
          rating?: number | null
          release_date?: string | null
          runtime_min?: number | null
          slug: string
          status?: string
          studio_id?: string | null
          trailer_url?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          age_rating?: number
          backdrop_url?: string | null
          created_at?: string
          deleted_at?: string | null
          format?: string | null
          id?: string
          is_classic?: boolean
          is_kids?: boolean
          kind?: Database["public"]["Enums"]["title_kind"]
          original_title?: string
          popularity?: number
          poster_url?: string | null
          published?: boolean
          rating?: number | null
          release_date?: string | null
          runtime_min?: number | null
          slug?: string
          status?: string
          studio_id?: string | null
          trailer_url?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "titles_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
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
      video_sources: {
        Row: {
          created_at: string
          episode_id: string | null
          id: string
          is_active: boolean
          kind: string
          provider: string | null
          title_id: string
          url: string
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          provider?: string | null
          title_id: string
          url: string
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          provider?: string | null
          title_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_sources_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sources_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string
          profile_id: string
          title_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          title_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_playback_source: {
        Args: { _episode?: string; _title: string }
        Returns: {
          kind: string
          subtitles: Json
          url: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_profile: { Args: { _profile: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
      title_kind: "movie" | "series" | "anime" | "manga"
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
      app_role: ["admin", "editor", "user"],
      title_kind: ["movie", "series", "anime", "manga"],
    },
  },
} as const
