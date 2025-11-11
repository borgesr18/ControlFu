import os
import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.getenv("DATABASE_URL")

def get_conn():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)

def init_db():
    if not DATABASE_URL:
        return
    
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS matches (
                    id SERIAL PRIMARY KEY,
                    home_team TEXT NOT NULL,
                    away_team TEXT NOT NULL,
                    home_score INTEGER,
                    away_score INTEGER,
                    match_date TIMESTAMPTZ NOT NULL,
                    status TEXT NOT NULL,
                    league TEXT NOT NULL
                )
            """)
            
            cur.execute("""
                CREATE TABLE IF NOT EXISTS bets (
                    id SERIAL PRIMARY KEY,
                    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                    bet_type TEXT NOT NULL,
                    odds NUMERIC(10,4) NOT NULL,
                    stake NUMERIC(12,2) NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    potential_return NUMERIC(12,2),
                    actual_return NUMERIC(12,2),
                    notes TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_bets_match_id ON bets(match_id)
            """)
            
            conn.commit()
