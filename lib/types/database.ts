// ===========================================================================
// Tipos TypeScript para las tablas de Supabase
// Sincronizados con data/supabase-schema.sql
// ===========================================================================

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          notes: string | null;
          agent: string | null;
          dni_hash: string | null;
          alias: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          agent?: string | null;
          dni_hash?: string | null;
          alias?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          agent?: string | null;
          dni_hash?: string | null;
          alias?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          client_id: string | null;
          account_number: string;
          label: string | null;
          ce: string | null;
          aportacion_mensual: number | null;
          is_active: boolean;
          agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          account_number: string;
          label?: string | null;
          ce?: string | null;
          aportacion_mensual?: number | null;
          is_active?: boolean;
          agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          account_number?: string;
          label?: string | null;
          ce?: string | null;
          aportacion_mensual?: number | null;
          is_active?: boolean;
          agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      positions: {
        Row: {
          id: string;
          account_id: string;
          snapshot_date: string;
          isin: string | null;
          product_name: string | null;
          manager: string | null;
          currency: string;
          units: number | null;
          avg_cost: number | null;
          market_price: number | null;
          position_value: number | null;
          fx_rate: number | null;
          purchase_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          snapshot_date: string;
          isin?: string | null;
          product_name?: string | null;
          manager?: string | null;
          currency?: string;
          units?: number | null;
          avg_cost?: number | null;
          market_price?: number | null;
          position_value?: number | null;
          fx_rate?: number | null;
          purchase_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          snapshot_date?: string;
          isin?: string | null;
          product_name?: string | null;
          manager?: string | null;
          currency?: string;
          units?: number | null;
          avg_cost?: number | null;
          market_price?: number | null;
          position_value?: number | null;
          fx_rate?: number | null;
          purchase_date?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "positions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      cash_balances: {
        Row: {
          id: string;
          account_id: string;
          snapshot_date: string;
          cash_account_number: string | null;
          currency: string;
          balance: number | null;
          sign: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          snapshot_date: string;
          cash_account_number?: string | null;
          currency?: string;
          balance?: number | null;
          sign?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          snapshot_date?: string;
          cash_account_number?: string | null;
          currency?: string;
          balance?: number | null;
          sign?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_balances_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      operations: {
        Row: {
          id: string;
          account_id: string;
          operation_number: string | null;
          operation_type: string | null;
          isin: string | null;
          product_name: string | null;
          operation_date: string | null;
          settlement_date: string | null;
          currency: string;
          units: number | null;
          gross_amount: number | null;
          net_amount: number | null;
          fx_rate: number | null;
          eur_amount: number | null;
          withholding: number | null;
          commission: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          operation_number?: string | null;
          operation_type?: string | null;
          isin?: string | null;
          product_name?: string | null;
          operation_date?: string | null;
          settlement_date?: string | null;
          currency?: string;
          units?: number | null;
          gross_amount?: number | null;
          net_amount?: number | null;
          fx_rate?: number | null;
          eur_amount?: number | null;
          withholding?: number | null;
          commission?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          operation_number?: string | null;
          operation_type?: string | null;
          isin?: string | null;
          product_name?: string | null;
          operation_date?: string | null;
          settlement_date?: string | null;
          currency?: string;
          units?: number | null;
          gross_amount?: number | null;
          net_amount?: number | null;
          fx_rate?: number | null;
          eur_amount?: number | null;
          withholding?: number | null;
          commission?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operations_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      uploads: {
        Row: {
          id: string;
          uploaded_by: string;
          file_names: string[];
          rows_inserted: number;
          status: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          uploaded_by: string;
          file_names?: string[];
          rows_inserted?: number;
          status?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          uploaded_by?: string;
          file_names?: string[];
          rows_inserted?: number;
          status?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ===========================================================================
// Convenience types
// ===========================================================================

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];

export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type AccountInsert = Database["public"]["Tables"]["accounts"]["Insert"];

export type Position = Database["public"]["Tables"]["positions"]["Row"];
export type PositionInsert = Database["public"]["Tables"]["positions"]["Insert"];

export type CashBalance = Database["public"]["Tables"]["cash_balances"]["Row"];
export type CashBalanceInsert = Database["public"]["Tables"]["cash_balances"]["Insert"];

export type Operation = Database["public"]["Tables"]["operations"]["Row"];
export type OperationInsert = Database["public"]["Tables"]["operations"]["Insert"];

export type Upload = Database["public"]["Tables"]["uploads"]["Row"];
export type UploadInsert = Database["public"]["Tables"]["uploads"]["Insert"];

// ===========================================================================
// MVP3 – Communication & Documents
// ===========================================================================

export interface Meeting {
  id: string;
  client_id: string;
  created_by: string;
  title: string;
  meeting_date: string;
  summary: string | null;
  key_points: string[] | null;
  agreed_actions: string[] | null;
  next_meeting_date: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  client_id: string;
  sender_id: string;
  content: string;
  is_from_advisor: boolean;
  read_at: string | null;
  created_at: string;
}

export type DocType = "minuta" | "informe" | "contrato" | "otro";

export interface Document {
  id: string;
  client_id: string;
  uploaded_by: string;
  name: string;
  description: string | null;
  file_path: string;
  file_size: number | null;
  doc_type: DocType;
  meeting_id: string | null;
  created_at: string;
}
