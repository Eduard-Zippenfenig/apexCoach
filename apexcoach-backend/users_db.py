import sqlite3
import hashlib
import json
import os
from pathlib import Path

DB_PATH = Path(__file__).parent / "users.db"

def _hash_password(password: str, salt: str = "apex_coach") -> str:
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            track TEXT NOT NULL,
            lap_time_s REAL,
            ref_lap_time_s REAL,
            gap_s REAL,
            scores TEXT,
            corners TEXT,
            summary TEXT,
            coaching_report TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.commit()
    conn.close()

def create_user(name: str, email: str, password: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (name, email, _hash_password(password))
        )
        conn.commit()
        user_id = cursor.lastrowid
        return get_user(user_id)
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def authenticate_user(email: str, password: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, email FROM users WHERE email = ? AND password_hash = ?",
        (email, _hash_password(password))
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "name": row[1], "email": row[2]}
    return None

def get_user(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "name": row[1], "email": row[2]}
    return None

def save_session(user_id: int, track: str, lap_time_s: float, ref_lap_time_s: float, gap_s: float, scores: dict, summary: str, corners: list = None, coaching_report: dict = None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sessions (user_id, track, lap_time_s, ref_lap_time_s, gap_s, scores, corners, summary, coaching_report)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id, track, lap_time_s, ref_lap_time_s, gap_s,
        json.dumps(scores) if scores else "{}",
        json.dumps(corners) if corners else "[]",
        summary,
        json.dumps(coaching_report) if coaching_report else "{}"
    ))
    conn.commit()
    session_id = cursor.lastrowid
    conn.close()
    return session_id

def get_user_sessions(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, track, lap_time_s, ref_lap_time_s, gap_s, scores, corners, summary, coaching_report, created_at
        FROM sessions WHERE user_id = ? ORDER BY created_at DESC
    ''', (user_id,))
    rows = cursor.fetchall()
    conn.close()
    sessions = []
    for r in rows:
        sessions.append({
            "id": r[0],
            "track": r[1],
            "lap_time_s": r[2],
            "ref_lap_time_s": r[3],
            "gap_s": r[4],
            "scores": json.loads(r[5]) if r[5] else {},
            "corners": json.loads(r[6]) if len(r) > 6 and r[6] else [],
            "summary": r[7],
            "coaching_report": json.loads(r[8]) if len(r) > 8 and r[8] else {},
            "created_at": r[9]
        })
    return sessions

def seed_demo_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", ("admin@login.com",))
    row = cursor.fetchone()
    conn.close()
    if not row:
        # Create admin
        user = create_user("Alex Mercer", "admin@login.com", "admin123")
        if user:
            # Add a dummy session
            scores = { "braking": 71, "line": 62, "throttle": 64, "smoothness": 78 }
            corners = [
                {"corner_name": "Turn 1", "estimated_time_loss_s": -0.1, "primary_issue": "Strong Entry"},
                {"corner_name": "Turn 7", "estimated_time_loss_s": 0.4, "primary_issue": "Late Apex"}
            ]
            coaching_report = {
                "executive_summary": "Solid session with clear improvement in braking zones.",
                "biggest_win": "Strong braking into Turn 1"
            }
            save_session(user["id"], "Yas Marina Circuit", 81.4, 74.8, 6.6, scores, "Solid session", corners, coaching_report)
