from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from decimal import Decimal
from app.db import init_db, get_conn, DATABASE_URL
import httpx
import os

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

class BetSelection(BaseModel):
    id: Optional[int] = None
    bet_id: Optional[int] = None
    match_id: int
    bet_type: BetType
    odds: float
    status: BetStatus = BetStatus.PENDING
    created_at: Optional[str] = None

class Bet(BaseModel):
    id: Optional[int] = None
    match_id: Optional[int] = None
    bet_type: Optional[BetType] = None
    odds: float
    stake: float
    status: BetStatus = BetStatus.PENDING
    potential_return: Optional[float] = None
    actual_return: Optional[float] = None
    notes: Optional[str] = None
    is_composite: bool = False
    selections: Optional[List[BetSelection]] = None
    created_at: Optional[str] = None

class CompositeBetCreate(BaseModel):
    stake: float
    notes: Optional[str] = None
    selections: List[BetSelection]

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

@app.post("/bets/composite", response_model=Bet)
async def create_composite_bet(composite_bet: CompositeBetCreate):
    if len(composite_bet.selections) < 2:
        raise HTTPException(status_code=400, detail="Composite bet must have at least 2 selections")
    
    with get_conn() as conn:
        with conn.cursor() as cur:
            for selection in composite_bet.selections:
                cur.execute("SELECT id FROM matches WHERE id = %s", (selection.match_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail=f"Match {selection.match_id} not found")
            
            combined_odds = 1.0
            for selection in composite_bet.selections:
                combined_odds *= selection.odds
            
            potential_return = float(composite_bet.stake) * combined_odds
            
            cur.execute("""
                INSERT INTO bets (bet_type, odds, stake, status, potential_return, actual_return, notes, is_composite)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, is_composite, created_at
            """, (None, combined_odds, composite_bet.stake, BetStatus.PENDING, 
                  potential_return, None, composite_bet.notes, True))
            bet_row = cur.fetchone()
            bet_id = bet_row['id']
            
            selections_data = []
            for selection in composite_bet.selections:
                cur.execute("""
                    INSERT INTO bet_selections (bet_id, match_id, bet_type, odds, status)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, bet_id, match_id, bet_type, odds, status, created_at
                """, (bet_id, selection.match_id, selection.bet_type, selection.odds, BetStatus.PENDING))
                sel_row = cur.fetchone()
                sel_row['odds'] = float(sel_row['odds'])
                sel_row['created_at'] = sel_row['created_at'].isoformat()
                selections_data.append(BetSelection(**sel_row))
            
            conn.commit()
            
            bet_row['odds'] = float(bet_row['odds'])
            bet_row['stake'] = float(bet_row['stake'])
            bet_row['potential_return'] = float(bet_row['potential_return']) if bet_row['potential_return'] else None
            bet_row['actual_return'] = float(bet_row['actual_return']) if bet_row['actual_return'] else None
            bet_row['created_at'] = bet_row['created_at'].isoformat()
            bet_row['selections'] = selections_data
            return Bet(**bet_row)

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
                INSERT INTO bets (match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, is_composite)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, is_composite, created_at
            """, (bet.match_id, bet.bet_type, bet.odds, bet.stake, bet.status, 
                  potential_return, actual_return, bet.notes, False))
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
            cur.execute("SELECT id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, is_composite, created_at FROM bets ORDER BY created_at DESC")
            rows = cur.fetchall()
            bets = []
            for row in rows:
                row['odds'] = float(row['odds'])
                row['stake'] = float(row['stake'])
                row['potential_return'] = float(row['potential_return']) if row['potential_return'] else None
                row['actual_return'] = float(row['actual_return']) if row['actual_return'] else None
                row['created_at'] = row['created_at'].isoformat()
                
                if row['is_composite']:
                    cur.execute("""
                        SELECT id, bet_id, match_id, bet_type, odds, status, created_at 
                        FROM bet_selections 
                        WHERE bet_id = %s
                    """, (row['id'],))
                    selections = cur.fetchall()
                    selections_data = []
                    for sel in selections:
                        sel['odds'] = float(sel['odds'])
                        sel['created_at'] = sel['created_at'].isoformat()
                        selections_data.append(BetSelection(**sel))
                    row['selections'] = selections_data
                
                bets.append(Bet(**row))
            return bets

@app.get("/bets/{bet_id}", response_model=Bet)
async def get_bet(bet_id: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, is_composite, created_at FROM bets WHERE id = %s", (bet_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Bet not found")
            row['odds'] = float(row['odds'])
            row['stake'] = float(row['stake'])
            row['potential_return'] = float(row['potential_return']) if row['potential_return'] else None
            row['actual_return'] = float(row['actual_return']) if row['actual_return'] else None
            row['created_at'] = row['created_at'].isoformat()
            
            if row['is_composite']:
                cur.execute("""
                    SELECT id, bet_id, match_id, bet_type, odds, status, created_at 
                    FROM bet_selections 
                    WHERE bet_id = %s
                """, (bet_id,))
                selections = cur.fetchall()
                selections_data = []
                for sel in selections:
                    sel['odds'] = float(sel['odds'])
                    sel['created_at'] = sel['created_at'].isoformat()
                    selections_data.append(BetSelection(**sel))
                row['selections'] = selections_data
            
            return Bet(**row)

@app.put("/bets/{bet_id}", response_model=Bet)
async def update_bet(bet_id: int, updated_bet: Bet):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_composite FROM bets WHERE id = %s", (bet_id,))
            bet_row = cur.fetchone()
            if not bet_row:
                raise HTTPException(status_code=404, detail="Bet not found")
            
            is_composite = bet_row['is_composite']
            
            if is_composite:
                cur.execute("""
                    SELECT id, status FROM bet_selections WHERE bet_id = %s
                """, (bet_id,))
                selections = cur.fetchall()
                
                all_won = all(sel['status'] == BetStatus.WON for sel in selections)
                any_lost = any(sel['status'] == BetStatus.LOST for sel in selections)
                any_void = any(sel['status'] == BetStatus.VOID for sel in selections)
                
                if any_lost:
                    bet_status = BetStatus.LOST
                elif any_void:
                    bet_status = BetStatus.VOID
                elif all_won:
                    bet_status = BetStatus.WON
                else:
                    bet_status = BetStatus.PENDING
                
                potential_return = float(updated_bet.stake) * updated_bet.odds
                actual_return = None
                
                if bet_status == BetStatus.WON:
                    actual_return = potential_return
                elif bet_status == BetStatus.LOST:
                    actual_return = 0.0
                elif bet_status == BetStatus.VOID:
                    actual_return = float(updated_bet.stake)
                
                cur.execute("""
                    UPDATE bets 
                    SET stake = %s, status = %s, potential_return = %s, actual_return = %s, notes = %s
                    WHERE id = %s
                    RETURNING id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, is_composite, created_at
                """, (updated_bet.stake, bet_status, potential_return, actual_return, updated_bet.notes, bet_id))
            else:
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
                    RETURNING id, match_id, bet_type, odds, stake, status, potential_return, actual_return, notes, is_composite, created_at
                """, (updated_bet.match_id, updated_bet.bet_type, updated_bet.odds, updated_bet.stake, 
                      updated_bet.status, potential_return, actual_return, updated_bet.notes, bet_id))
            
            row = cur.fetchone()
            conn.commit()
            
            row['odds'] = float(row['odds'])
            row['stake'] = float(row['stake'])
            row['potential_return'] = float(row['potential_return']) if row['potential_return'] else None
            row['actual_return'] = float(row['actual_return']) if row['actual_return'] else None
            row['created_at'] = row['created_at'].isoformat()
            
            if is_composite:
                cur.execute("""
                    SELECT id, bet_id, match_id, bet_type, odds, status, created_at 
                    FROM bet_selections 
                    WHERE bet_id = %s
                """, (bet_id,))
                selections = cur.fetchall()
                selections_data = []
                for sel in selections:
                    sel['odds'] = float(sel['odds'])
                    sel['created_at'] = sel['created_at'].isoformat()
                    selections_data.append(BetSelection(**sel))
                row['selections'] = selections_data
            
            return Bet(**row)

@app.put("/bet-selections/{selection_id}")
async def update_bet_selection(selection_id: int, status: BetStatus):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE bet_selections 
                SET status = %s
                WHERE id = %s
                RETURNING bet_id
            """, (status, selection_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Bet selection not found")
            
            bet_id = row['bet_id']
            
            cur.execute("""
                SELECT id, status FROM bet_selections WHERE bet_id = %s
            """, (bet_id,))
            selections = cur.fetchall()
            
            all_won = all(sel['status'] == BetStatus.WON for sel in selections)
            any_lost = any(sel['status'] == BetStatus.LOST for sel in selections)
            any_void = any(sel['status'] == BetStatus.VOID for sel in selections)
            
            if any_lost:
                bet_status = BetStatus.LOST
            elif any_void:
                bet_status = BetStatus.VOID
            elif all_won:
                bet_status = BetStatus.WON
            else:
                bet_status = BetStatus.PENDING
            
            cur.execute("""
                SELECT stake, odds FROM bets WHERE id = %s
            """, (bet_id,))
            bet_row = cur.fetchone()
            stake = float(bet_row['stake'])
            odds = float(bet_row['odds'])
            
            potential_return = stake * odds
            actual_return = None
            
            if bet_status == BetStatus.WON:
                actual_return = potential_return
            elif bet_status == BetStatus.LOST:
                actual_return = 0.0
            elif bet_status == BetStatus.VOID:
                actual_return = stake
            
            cur.execute("""
                UPDATE bets 
                SET status = %s, actual_return = %s
                WHERE id = %s
            """, (bet_status, actual_return, bet_id))
            
            conn.commit()
            return {"message": "Bet selection updated", "bet_id": bet_id, "new_bet_status": bet_status}

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

class ImportMatchesRequest(BaseModel):
    date: str
    leagues: Optional[List[int]] = None

class ImportMatchesResponse(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: List[str]

LEAGUE_IDS = {
    'brasileirao_a': 71,
    'brasileirao_b': 72,
    'copa_do_brasil': 73,
    'premier_league': 39,
    'la_liga': 140,
    'serie_a': 135,
    'bundesliga': 78,
    'ligue_1': 61,
    'champions_league': 2,
    'europa_league': 3,
    'libertadores': 13,
    'sul_americana': 11,
    'liga_portugal': 94,
    'eredivisie': 88,
    'championship': 40
}

def map_api_status_to_internal(api_status: str) -> str:
    status_map = {
        'TBD': 'scheduled',
        'NS': 'scheduled',
        '1H': 'live',
        'HT': 'live',
        '2H': 'live',
        'ET': 'live',
        'P': 'live',
        'FT': 'finished',
        'AET': 'finished',
        'PEN': 'finished',
        'PST': 'cancelled',
        'CANC': 'cancelled',
        'SUSP': 'cancelled',
        'ABD': 'cancelled',
        'WO': 'cancelled',
        'AWD': 'cancelled'
    }
    return status_map.get(api_status, 'scheduled')

@app.post("/integrations/import-matches", response_model=ImportMatchesResponse)
async def import_matches(
    request: ImportMatchesRequest,
    x_import_secret: Optional[str] = Header(None)
):
    import_secret = os.getenv("IMPORT_SECRET")
    if import_secret and x_import_secret != import_secret:
        raise HTTPException(status_code=403, detail="Invalid import secret")
    
    api_key = os.getenv("API_FOOTBALL_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API_FOOTBALL_KEY not configured")
    
    leagues_to_import = request.leagues or list(LEAGUE_IDS.values())
    
    inserted = 0
    updated = 0
    skipped = 0
    errors = []
    
    async with httpx.AsyncClient() as client:
        for league_id in leagues_to_import:
            try:
                response = await client.get(
                    "https://v3.football.api-sports.io/fixtures",
                    headers={"x-apisports-key": api_key},
                    params={
                        "date": request.date,
                        "league": league_id,
                        "season": 2024,
                        "timezone": "America/Sao_Paulo"
                    },
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    errors.append(f"League {league_id}: API returned {response.status_code}")
                    continue
                
                data = response.json()
                fixtures = data.get("response", [])
                
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        for fixture in fixtures:
                            try:
                                external_id = str(fixture["fixture"]["id"])
                                home_team = fixture["teams"]["home"]["name"]
                                away_team = fixture["teams"]["away"]["name"]
                                match_date = fixture["fixture"]["date"]
                                status = map_api_status_to_internal(fixture["fixture"]["status"]["short"])
                                league_name = fixture["league"]["name"]
                                country = fixture["league"]["country"]
                                season = fixture["league"]["season"]
                                venue = fixture["fixture"]["venue"]["name"] if fixture["fixture"]["venue"] else None
                                home_score = fixture["goals"]["home"]
                                away_score = fixture["goals"]["away"]
                                
                                cur.execute("""
                                    SELECT id FROM matches WHERE external_id = %s
                                """, (external_id,))
                                existing = cur.fetchone()
                                
                                if existing:
                                    cur.execute("""
                                        UPDATE matches 
                                        SET home_team = %s, away_team = %s, match_date = %s, 
                                            status = %s, league = %s, country = %s, season = %s,
                                            venue = %s, home_score = %s, away_score = %s
                                        WHERE external_id = %s
                                    """, (home_team, away_team, match_date, status, league_name,
                                          country, season, venue, home_score, away_score, external_id))
                                    updated += 1
                                else:
                                    cur.execute("""
                                        INSERT INTO matches 
                                        (home_team, away_team, match_date, status, league, 
                                         external_id, country, season, venue, home_score, away_score)
                                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                    """, (home_team, away_team, match_date, status, league_name,
                                          external_id, country, season, venue, home_score, away_score))
                                    inserted += 1
                                
                            except Exception as e:
                                errors.append(f"Fixture {fixture.get('fixture', {}).get('id', 'unknown')}: {str(e)}")
                                skipped += 1
                        
                        conn.commit()
                
            except Exception as e:
                errors.append(f"League {league_id}: {str(e)}")
    
    return ImportMatchesResponse(
        inserted=inserted,
        updated=updated,
        skipped=skipped,
        errors=errors
    )
