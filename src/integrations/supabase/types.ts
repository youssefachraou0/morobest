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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          content_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          admin_id: string
          content_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string
          content_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          granted_at: string
          permission: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          permission: string
          user_id: string
        }
        Update: {
          granted_at?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_daily: {
        Row: {
          clicks: number
          completions: number
          content_key: string
          day: string
          errors: number
          favorite_adds: number
          impressions: number
          starts: number
          title_id: string | null
          unique_viewers: number
          views: number
          watch_seconds: number
          watchlist_adds: number
        }
        Insert: {
          clicks?: number
          completions?: number
          content_key: string
          day: string
          errors?: number
          favorite_adds?: number
          impressions?: number
          starts?: number
          title_id?: string | null
          unique_viewers?: number
          views?: number
          watch_seconds?: number
          watchlist_adds?: number
        }
        Update: {
          clicks?: number
          completions?: number
          content_key?: string
          day?: string
          errors?: number
          favorite_adds?: number
          impressions?: number
          starts?: number
          title_id?: string | null
          unique_viewers?: number
          views?: number
          watch_seconds?: number
          watchlist_adds?: number
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          content_key: string | null
          ctx: string | null
          episode_id: string | null
          event: string
          id: number
          is_test: boolean
          occurred_at: string
          path: string | null
          props: Json
          session: string | null
          title_id: string | null
          value: number | null
          visitor: string
        }
        Insert: {
          content_key?: string | null
          ctx?: string | null
          episode_id?: string | null
          event: string
          id?: number
          is_test?: boolean
          occurred_at?: string
          path?: string | null
          props?: Json
          session?: string | null
          title_id?: string | null
          value?: number | null
          visitor: string
        }
        Update: {
          content_key?: string | null
          ctx?: string | null
          episode_id?: string | null
          event?: string
          id?: number
          is_test?: boolean
          occurred_at?: string
          path?: string | null
          props?: Json
          session?: string | null
          title_id?: string | null
          value?: number | null
          visitor?: string
        }
        Relationships: []
      }
      analytics_meta: {
        Row: {
          details: Json
          key: string
          ran_at: string
        }
        Insert: {
          details?: Json
          key: string
          ran_at?: string
        }
        Update: {
          details?: Json
          key?: string
          ran_at?: string
        }
        Relationships: []
      }
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
      content_links: {
        Row: {
          content_type: string
          id: string
          is_primary: boolean
          linked_at: string
          linked_by: string | null
          provider: string
          provider_id: string
          title_id: string
        }
        Insert: {
          content_type: string
          id?: string
          is_primary?: boolean
          linked_at?: string
          linked_by?: string | null
          provider: string
          provider_id: string
          title_id: string
        }
        Update: {
          content_type?: string
          id?: string
          is_primary?: boolean
          linked_at?: string
          linked_by?: string | null
          provider?: string
          provider_id?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_links_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_overrides: {
        Row: {
          content_type: string
          id: string
          locale: string
          overview: string | null
          provider: string
          provider_id: string
          short_description: string | null
          subtitle: string | null
          tagline: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_type: string
          id?: string
          locale: string
          overview?: string | null
          provider: string
          provider_id: string
          short_description?: string | null
          subtitle?: string | null
          tagline?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_type?: string
          id?: string
          locale?: string
          overview?: string | null
          provider?: string
          provider_id?: string
          short_description?: string | null
          subtitle?: string | null
          tagline?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
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
      crawler_hits: {
        Row: {
          bot: string
          day: string
          hits: number
          section: string
        }
        Insert: {
          bot: string
          day: string
          hits?: number
          section: string
        }
        Update: {
          bot?: string
          day?: string
          hits?: number
          section?: string
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
      episode_links: {
        Row: {
          episode_id: string | null
          episode_number: number
          id: string
          is_manual: boolean
          provider: string
          provider_id: string
          season_number: number
          series_title_id: string
          updated_at: string
        }
        Insert: {
          episode_id?: string | null
          episode_number: number
          id?: string
          is_manual?: boolean
          provider: string
          provider_id: string
          season_number: number
          series_title_id: string
          updated_at?: string
        }
        Update: {
          episode_id?: string | null
          episode_number?: number
          id?: string
          is_manual?: boolean
          provider?: string
          provider_id?: string
          season_number?: number
          series_title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_links_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_links_series_title_id_fkey"
            columns: ["series_title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          air_date: string | null
          credits_start_s: number | null
          id: string
          intro_end_s: number | null
          intro_start_s: number | null
          number: number
          recap_end_s: number | null
          recap_start_s: number | null
          runtime_min: number | null
          season_id: string
          synopsis: string | null
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          air_date?: string | null
          credits_start_s?: number | null
          id?: string
          intro_end_s?: number | null
          intro_start_s?: number | null
          number: number
          recap_end_s?: number | null
          recap_start_s?: number | null
          runtime_min?: number | null
          season_id: string
          synopsis?: string | null
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          air_date?: string | null
          credits_start_s?: number | null
          id?: string
          intro_end_s?: number | null
          intro_start_s?: number | null
          number?: number
          recap_end_s?: number | null
          recap_start_s?: number | null
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
      external_titles: {
        Row: {
          created_at: string
          custom_translations: Json
          id: string
          media_type: string
          provider: string
          provider_id: string
          seo_description: string | null
          seo_title: string | null
          title_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_translations?: Json
          id?: string
          media_type: string
          provider?: string
          provider_id: string
          seo_description?: string | null
          seo_title?: string | null
          title_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_translations?: Json
          id?: string
          media_type?: string
          provider?: string
          provider_id?: string
          seo_description?: string | null
          seo_title?: string | null
          title_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_titles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
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
      playback_errors: {
        Row: {
          created_at: string
          device: string | null
          id: string
          message: string
          provider: string | null
          source_id: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          message: string
          provider?: string | null
          source_id?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          message?: string
          provider?: string | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playback_errors_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      playback_progress: {
        Row: {
          completed: boolean
          duration_s: number
          episode_id: string | null
          id: string
          last_watched_at: string
          percentage: number | null
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
          last_watched_at?: string
          percentage?: number | null
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
          last_watched_at?: string
          percentage?: number | null
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
          audio_lang: string | null
          autoplay_next: boolean
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
          audio_lang?: string | null
          autoplay_next?: boolean
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
          audio_lang?: string | null
          autoplay_next?: boolean
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
          archived_at: string | null
          description: string | null
          ends_on: string
          hero_image: string | null
          id: string
          is_active: boolean
          is_current: boolean
          is_featured: boolean
          name_ar: string | null
          name_en: string | null
          name_fr: string | null
          starts_on: string
          year: number
        }
        Insert: {
          archived_at?: string | null
          description?: string | null
          ends_on: string
          hero_image?: string | null
          id?: string
          is_active?: boolean
          is_current?: boolean
          is_featured?: boolean
          name_ar?: string | null
          name_en?: string | null
          name_fr?: string | null
          starts_on: string
          year: number
        }
        Update: {
          archived_at?: string | null
          description?: string | null
          ends_on?: string
          hero_image?: string | null
          id?: string
          is_active?: boolean
          is_current?: boolean
          is_featured?: boolean
          name_ar?: string | null
          name_en?: string | null
          name_fr?: string | null
          starts_on?: string
          year?: number
        }
        Relationships: []
      }
      ramadan_titles: {
        Row: {
          air_time: string | null
          country_code: string | null
          created_at: string
          featured: boolean
          id: string
          media_type: string
          notes: string | null
          ord: number
          provider: string
          provider_id: string
          release_schedule: string | null
          season_id: string
          status: string
          title_id: string | null
        }
        Insert: {
          air_time?: string | null
          country_code?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          media_type?: string
          notes?: string | null
          ord?: number
          provider?: string
          provider_id: string
          release_schedule?: string | null
          season_id: string
          status?: string
          title_id?: string | null
        }
        Update: {
          air_time?: string | null
          country_code?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          media_type?: string
          notes?: string | null
          ord?: number
          provider?: string
          provider_id?: string
          release_schedule?: string | null
          season_id?: string
          status?: string
          title_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ramadan_titles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "ramadan_titles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "ramadan_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ramadan_titles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
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
      seo_overrides: {
        Row: {
          canonical_url: string | null
          content_type: string
          follow_links: boolean
          id: string
          indexable: boolean
          meta_description_ar: string | null
          meta_description_en: string | null
          meta_description_fr: string | null
          og_description: string | null
          og_image: string | null
          og_title: string | null
          provider: string
          provider_id: string
          schema: Json | null
          seo_title_ar: string | null
          seo_title_en: string | null
          seo_title_fr: string | null
          slug: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          canonical_url?: string | null
          content_type: string
          follow_links?: boolean
          id?: string
          indexable?: boolean
          meta_description_ar?: string | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          provider: string
          provider_id: string
          schema?: Json | null
          seo_title_ar?: string | null
          seo_title_en?: string | null
          seo_title_fr?: string | null
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          canonical_url?: string | null
          content_type?: string
          follow_links?: boolean
          id?: string
          indexable?: boolean
          meta_description_ar?: string | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          provider?: string
          provider_id?: string
          schema?: Json | null
          seo_title_ar?: string | null
          seo_title_en?: string | null
          seo_title_fr?: string | null
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      slug_redirects: {
        Row: {
          content_type: string
          created_at: string
          id: string
          old_slug: string
          provider: string
          provider_id: string
        }
        Insert: {
          content_type: string
          created_at?: string
          id?: string
          old_slug: string
          provider: string
          provider_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          id?: string
          old_slug?: string
          provider?: string
          provider_id?: string
        }
        Relationships: []
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
          created_at: string
          episode_id: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_forced: boolean
          is_sdh: boolean
          label: string
          lang: string
          title_id: string | null
          url: string
          video_source_id: string | null
          vtt: string | null
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_forced?: boolean
          is_sdh?: boolean
          label: string
          lang: string
          title_id?: string | null
          url: string
          video_source_id?: string | null
          vtt?: string | null
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_forced?: boolean
          is_sdh?: boolean
          label?: string
          lang?: string
          title_id?: string | null
          url?: string
          video_source_id?: string | null
          vtt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtitle_tracks_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtitle_tracks_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
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
          content_status: string
          created_at: string
          credits_start_s: number | null
          deleted_at: string | null
          format: string | null
          id: string
          intro_end_s: number | null
          intro_start_s: number | null
          is_classic: boolean
          is_demo: boolean
          is_diagnostic: boolean
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
          content_status?: string
          created_at?: string
          credits_start_s?: number | null
          deleted_at?: string | null
          format?: string | null
          id?: string
          intro_end_s?: number | null
          intro_start_s?: number | null
          is_classic?: boolean
          is_demo?: boolean
          is_diagnostic?: boolean
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
          content_status?: string
          created_at?: string
          credits_start_s?: number | null
          deleted_at?: string | null
          format?: string | null
          id?: string
          intro_end_s?: number | null
          intro_start_s?: number | null
          is_classic?: boolean
          is_demo?: boolean
          is_diagnostic?: boolean
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
      video_source_audit: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json | null
          id: string
          source_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          source_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          source_id?: string | null
        }
        Relationships: []
      }
      video_sources: {
        Row: {
          audio_language: string | null
          availability_country: string[] | null
          available_from: string | null
          available_until: string | null
          created_at: string
          duration_s: number | null
          episode_id: string | null
          error_message: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_dubbed: boolean
          is_subbed: boolean
          is_test_source: boolean
          kind: string
          language: string | null
          original_filename: string | null
          playback_id: string | null
          priority: number
          provider: string | null
          provider_asset_id: string | null
          quality: string | null
          replaces_source_ids: string[] | null
          requires_signed_token: boolean
          rights_confirmed_at: string | null
          rights_confirmed_by: string | null
          status: string
          title_id: string
          updated_at: string
          upload_id: string | null
          url: string
        }
        Insert: {
          audio_language?: string | null
          availability_country?: string[] | null
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          duration_s?: number | null
          episode_id?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_dubbed?: boolean
          is_subbed?: boolean
          is_test_source?: boolean
          kind?: string
          language?: string | null
          original_filename?: string | null
          playback_id?: string | null
          priority?: number
          provider?: string | null
          provider_asset_id?: string | null
          quality?: string | null
          replaces_source_ids?: string[] | null
          requires_signed_token?: boolean
          rights_confirmed_at?: string | null
          rights_confirmed_by?: string | null
          status?: string
          title_id: string
          updated_at?: string
          upload_id?: string | null
          url: string
        }
        Update: {
          audio_language?: string | null
          availability_country?: string[] | null
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          duration_s?: number | null
          episode_id?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_dubbed?: boolean
          is_subbed?: boolean
          is_test_source?: boolean
          kind?: string
          language?: string | null
          original_filename?: string | null
          playback_id?: string | null
          priority?: number
          provider?: string | null
          provider_asset_id?: string | null
          quality?: string | null
          replaces_source_ids?: string[] | null
          requires_signed_token?: boolean
          rights_confirmed_at?: string | null
          rights_confirmed_by?: string | null
          status?: string
          title_id?: string
          updated_at?: string
          upload_id?: string | null
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
      admin_analytics_cleanup: { Args: never; Returns: Json }
      admin_analytics_purge_test: { Args: never; Returns: number }
      analytics_dashboard: {
        Args: { _from: string; _include_test?: boolean; _to: string }
        Returns: Json
      }
      analytics_key: { Args: { _key: string; _title: string }; Returns: string }
      analytics_maintain: { Args: never; Returns: undefined }
      analytics_maintain_if_due: { Args: never; Returns: boolean }
      analytics_rollup: { Args: { _day: string }; Returns: undefined }
      analytics_title: {
        Args: {
          _from: string
          _include_test?: boolean
          _title: string
          _to: string
        }
        Returns: Json
      }
      can_manage_content: { Args: { _user_id: string }; Returns: boolean }
      can_manage_media: { Args: { _user_id: string }; Returns: boolean }
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
      is_analytics_admin: { Args: { _u: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      owns_profile: { Args: { _profile: string }; Returns: boolean }
      playable_units: {
        Args: { _include_test?: boolean; _title: string }
        Returns: {
          episode_id: string
          test_only: boolean
        }[]
      }
      playback_candidates: {
        Args: {
          _country?: string
          _episode?: string
          _include_test?: boolean
          _title: string
        }
        Returns: {
          audio_language: string
          id: string
          is_dubbed: boolean
          is_test_source: boolean
          kind: string
          language: string
          playback_id: string
          provider: string
          provider_asset_id: string
          quality: string
          requires_signed_token: boolean
          subtitles: Json
          url: string
        }[]
      }
      public_playable_units: {
        Args: { _title: string }
        Returns: {
          episode_id: string
        }[]
      }
      subtitle_vtt: { Args: { _id: string }; Returns: string }
      title_is_public: { Args: { _title: string }; Returns: boolean }
      trending_content: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          content_key: string
          score: number
          title_id: string
          viewers: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "editor"
        | "user"
        | "super_admin"
        | "content_manager"
        | "support"
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
      app_role: [
        "admin",
        "editor",
        "user",
        "super_admin",
        "content_manager",
        "support",
      ],
      title_kind: ["movie", "series", "anime", "manga"],
    },
  },
} as const
