from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from decimal import Decimal
from app.db import init_db, get_conn, DATABASE_URL

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    if DATABASE_URL:
        init_db()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MatchStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    FINISHED = "finished"
    CANCELLED = "cancelled"

class BetType(str, Enum):
    HOME_WIN = "home_win"
    DRAW = "draw"
    AWAY_WIN = "away_win"
    OVER_GOALS = "over_goals"
    UNDER_GOALS = "under_goals"
    BOTH_SCORE = "both_score"

class BetStatus(str, Enum):
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    VOID = "void"

class Match(BaseModel):
    id: Optional[int] = None
    home_team: str
    away_team: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    match_date: str
    status: MatchStatus = MatchStatus.SCHEDULED
    league: str

class Bet(BaseModel):
    id: Optional[int] = None
    match_id: int
    bet_type: BetType
    odds: float
    stake: float
    status: BetStatus = BetStatus.PENDING
    potential_return: Optional[float] = None
    actual_return: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None

class Statistics(BaseModel):
    total_bets: int
    total_stake: float
    total_return: float
    profit_loss: float
    won_bets: int
    lost_bets: int
    pending_bets: int
    win_rate: float
    roi: float

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.post("/matches", response_model=Match)
async def create_match(match: Match):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO matches (home_team, away_team, home_score, away_score, match_date, status, league)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, home_team, away_team, home_score, away_score, match_date, status, league
            """, (match.home_team, match.away_team, match.home_score, match.away_score, 
                  match.match_date, match.status, match.league))
            row = cur.fetchone()
            conn.commit()
            row['match_date'] = row['match_date'].isoformat()
            return Match(**row)

@app.get("/matches", response_model=List[Match])
async def list_matches():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, home_team, away_team, home_score, away_score, match_date, status, league FROM matches ORDER BY match_date DESC")
            rows = cur.fetchall()
            for row in rows:
                row['match_date'] = row['match_date'].isoformat()
            return [Match(**row) for row in rows]

@app.get("/matches/{match_id}", response_model=Match)
async def get_match(match_id: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, home_team, away_team, home_score, away_score, match_date, status, league FROM matches WHERE id = %s", (match_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Match not found")
            row['match_date'] = row['match_date'].isoformat()
            return Match(**row)

@app.put("/matches/{match_id}", response_model=Match)
async def update_match(match_id: int, updated_match: Match):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE matches 
                SET home_team = %s, away_team = %s, home_score = %s, away_score = %s, 
                    match_date = %s, status = %s, league = %s
                WHERE id = %s
                RETURNING id, home_team, away_team, home_score, away_score, match_date, status, league
            """, (updated_match.home_team, updated_match.away_team, updated_match.home_score, 
                  updated_match.away_score, updated_match.match_date, updated_match.status, 
                  updated_match.league, match_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Match not found")
            conn.commit()
            row['match_date'] = row['match_date'].isoformat()
            return Match(**row)

@app.delete("/matches/{match_id}")
async def delete_match(match_id: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM matches WHERE id = %s RETURNING id", (match_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Match not found")
            conn.commit()
            return {"message": "Match deleted"}

@app.post("/bets", response_model=Bet)
async def create_bet(bet: Bet):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM matches WHERE id = %s", (bet.match_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Match not found")
            
            potential_return = float(bet.stake) * bet.odds
            actual_return = None
            
            if bet.status == BetStatus.WON:
                actual_return = potential_return
            elif bet.status == BetStatus.LOST:
                actual_return = 0.0
            
            cur.execute("""
                INSERT INTO bets (match_id, bet_type, odds, stake, status, potential_return, actual_return, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, created_at
            """, (bet.match_id, bet.bet_type, bet.odds, bet.stake, bet.status, 
                  potential_return, actual_return, bet.notes))
            row = cur.fetchone()
            conn.commit()
            
            row['odds'] = float(row['odds'])
            row['stake'] = float(row['stake'])
            row['potential_return'] = float(row['potential_return']) if row['potential_return'] else None
            row['actual_return'] = float(row['actual_return']) if row['actual_return'] else None
            row['created_at'] = row['created_at'].isoformat()
            return Bet(**row)

@app.get("/bets", response_model=List[Bet])
async def list_bets():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, created_at FROM bets ORDER BY created_at DESC")
            rows = cur.fetchall()
            for row in rows:
                row['odds'] = float(row['odds'])
                row['stake'] = float(row['stake'])
                row['potential_return'] = float(row['potential_return']) if row['potential_return'] else None
                row['actual_return'] = float(row['actual_return']) if row['actual_return'] else None
                row['created_at'] = row['created_at'].isoformat()
            return [Bet(**row) for row in rows]

@app.get("/bets/{bet_id}", response_model=Bet)
async def get_bet(bet_id: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, created_at FROM bets WHERE id = %s", (bet_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Bet not found")
            row['odds'] = float(row['odds'])
            row['stake'] = float(row['stake'])
            row['potential_return'] = float(row['potential_return']) if row['potential_return'] else None
            row['actual_return'] = float(row['actual_return']) if row['actual_return'] else None
            row['created_at'] = row['created_at'].isoformat()
            return Bet(**row)

@app.put("/bets/{bet_id}", response_model=Bet)
async def update_bet(bet_id: int, updated_bet: Bet):
    with get_conn() as conn:
        with conn.cursor() as cur:
            potential_return = float(updated_bet.stake) * updated_bet.odds
            actual_return = None
            
            if updated_bet.status == BetStatus.WON:
                actual_return = potential_return
            elif updated_bet.status == BetStatus.LOST:
                actual_return = 0.0
            elif updated_bet.status == BetStatus.VOID:
                actual_return = float(updated_bet.stake)
            
            cur.execute("""
                UPDATE bets 
                SET match_id = %s, bet_type = %s, odds = %s, stake = %s, status = %s, 
                    potential_return = %s, actual_return = %s, notes = %s
                WHERE id = %s
                RETURNING id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, created_at
            """, (updated_bet.match_id, updated_bet.bet_type, updated_bet.odds, updated_bet.stake, 
                  updated_bet.status, potential_return, actual_return, updated_bet.notes, bet_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Bet not found")
            conn.commit()
            
            row['odds'] = float(row['odds'])
            row['stake'] = float(row['stake'])
            row['potential_return'] = float(row['potential_return']) if row['potential_return'] else None
            row['actual_return'] = float(row['actual_return']) if row['actual_return'] else None
            row['created_at'] = row['created_at'].isoformat()
            return Bet(**row)

@app.delete("/bets/{bet_id}")
async def delete_bet(bet_id: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM bets WHERE id = %s RETURNING id", (bet_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Bet not found")
            conn.commit()
            return {"message": "Bet deleted"}

@app.get("/statistics", response_model=Statistics)
async def get_statistics():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) AS total_bets,
                    COALESCE(SUM(stake), 0) AS total_stake,
                    COALESCE(SUM(COALESCE(actual_return, 0)), 0) AS total_return,
                    SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won_bets,
                    SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost_bets,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_bets
                FROM bets
            """)
            row = cur.fetchone()
            
            total_bets = row['total_bets']
            total_stake = float(row['total_stake'])
            total_return = float(row['total_return'])
            won_bets = row['won_bets']
            lost_bets = row['lost_bets']
            pending_bets = row['pending_bets']
            
            profit_loss = total_return - total_stake
            win_rate = (won_bets / total_bets * 100) if total_bets > 0 else 0
            roi = (profit_loss / total_stake * 100) if total_stake > 0 else 0
            
            return Statistics(
                total_bets=total_bets,
                total_stake=total_stake,
                total_return=total_return,
                profit_loss=profit_loss,
                won_bets=won_bets,
                lost_bets=lost_bets,
                pending_bets=pending_bets,
                win_rate=win_rate,
                roi=roi
            )
