import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from queue import Empty, Queue
from threading import Lock
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "overlay_history.db"
SETTINGS_PATH = ROOT / "data" / "overlay_settings.json"
RUNTIME_STATE_PATH = ROOT / "data" / "platform_runtime.json"
TRAIN_STATUS_PATH = ROOT / "data" / "train-status.json"
TRAIN_ACTIVE_PATH = ROOT / "data" / "train-active.txt"
YOUTUBE_DEBUG_PATH = ROOT / "data" / "youtube-message-debug.jsonl"
RUNTIME_DEBUG_PATH = ROOT / "data" / "runtime-debug.jsonl"
KICK_VIEWER_DEBUG_PATH = ROOT / "data" / "kick-viewer-debug.jsonl"
KICK_GIFTS_DEBUG_PATH = ROOT / "data" / "kick-gifts-debug.jsonl"
YOUTUBE_PAID_DEBUG_PATH = ROOT / "data" / "youtube-paid-debug.jsonl"
GIFT_RECIPIENT_DEBUG_PATH = ROOT / "data" / "gift-recipient-debug.jsonl"
PARSE_FAILURE_DEBUG_PATH = ROOT / "data" / "parse-failures-debug.jsonl"
DB_LOCK = Lock()
STREAM_LOCK = Lock()
STREAM_SUBSCRIBERS = set()
TWITCH_AVATAR_CACHE = {}
TWITCH_AVATAR_CACHE_TTL_SEC = 60 * 60 * 6


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DB_LOCK:
        connection = sqlite3.connect(DB_PATH)
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                variant TEXT NOT NULL,
                username TEXT NOT NULL,
                text TEXT NOT NULL,
                color TEXT,
                avatar_url TEXT,
                is_broadcaster INTEGER NOT NULL DEFAULT 0,
                timestamp_ms INTEGER NOT NULL,
                badges_json TEXT NOT NULL,
                amount_text TEXT,
                tone TEXT,
                member_label TEXT,
                message_id TEXT,
                user_id TEXT,
                gift_id TEXT,
                gift_name TEXT,
                gift_image_url TEXT
            )
            """
        )
        ensure_column(connection, "messages", "amount_text", "TEXT")
        ensure_column(connection, "messages", "tone", "TEXT")
        ensure_column(connection, "messages", "member_label", "TEXT")
        ensure_column(connection, "messages", "message_id", "TEXT")
        ensure_column(connection, "messages", "user_id", "TEXT")
        ensure_column(connection, "messages", "content_parts_json", "TEXT")
        ensure_column(connection, "messages", "gift_id", "TEXT")
        ensure_column(connection, "messages", "gift_name", "TEXT")
        ensure_column(connection, "messages", "gift_image_url", "TEXT")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS removed_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                message_id TEXT NOT NULL,
                removed_at_ms INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp_ms)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_removed_messages_lookup ON removed_messages(platform, message_id)"
        )
        connection.commit()
        connection.close()
    init_settings_store()


def init_settings_store() -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SETTINGS_PATH.exists():
        init_train_status_store()
        return
    SETTINGS_PATH.write_text("{}", encoding="utf-8")
    init_train_status_store()


def init_train_status_store() -> None:
    TRAIN_STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not TRAIN_STATUS_PATH.exists():
        save_train_status({})
    if not TRAIN_ACTIVE_PATH.exists():
        TRAIN_ACTIVE_PATH.write_text("0", encoding="utf-8")


def ensure_column(connection: sqlite3.Connection, table_name: str, column_name: str, column_type: str) -> None:
    existing_columns = {
        row[1]
        for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name in existing_columns:
        return
    connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def row_to_message(row: sqlite3.Row) -> dict:
    return {
        "platform": row["platform"],
        "variant": row["variant"],
        "username": row["username"],
        "text": row["text"],
        "color": row["color"],
        "avatarUrl": row["avatar_url"] or "",
        "messageId": row["message_id"] or "",
        "userId": row["user_id"] or "",
        "isBroadcaster": bool(row["is_broadcaster"]),
        "timestamp": row["timestamp_ms"],
        "badges": json.loads(row["badges_json"] or "[]"),
        "amountText": row["amount_text"] or "",
        "tone": row["tone"] or "",
        "memberLabel": row["member_label"] or "",
        "giftId": row["gift_id"] or "",
        "giftName": row["gift_name"] or "",
        "giftImageUrl": row["gift_image_url"] or "",
        "contentParts": json.loads(row["content_parts_json"] or "[]"),
    }


class OverlayHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/history":
            self.handle_history_get()
            return
        if parsed.path == "/api/settings":
            self.handle_settings_get()
            return
        if parsed.path == "/api/runtime-state":
            self.handle_runtime_state_get()
            return
        if parsed.path == "/api/train-status":
            self.handle_train_status_get()
            return
        if parsed.path == "/api/debug/youtube-message":
            self.handle_youtube_debug_get()
            return
        if parsed.path == "/api/debug/runtime":
            self.handle_runtime_debug_get()
            return
        if parsed.path == "/api/debug/kick-viewer":
            self.handle_kick_viewer_debug_get()
            return
        if parsed.path == "/api/debug/kick-gifts":
            self.send_json(load_debug_rows(KICK_GIFTS_DEBUG_PATH))
            return
        if parsed.path == "/api/debug/youtube-paid":
            self.send_json(load_debug_rows(YOUTUBE_PAID_DEBUG_PATH))
            return
        if parsed.path == "/api/debug/gift-recipient":
            self.send_json(load_debug_rows(GIFT_RECIPIENT_DEBUG_PATH))
            return
        if parsed.path == "/api/debug/parse-failures":
            self.send_json(load_debug_rows(PARSE_FAILURE_DEBUG_PATH))
            return
        if parsed.path == "/api/history/stream":
            self.handle_history_stream()
            return
        if parsed.path == "/api/twitch/avatar":
            self.handle_twitch_avatar_get(parsed)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/history":
            self.handle_history_post()
            return
        if parsed.path == "/api/settings":
            self.handle_settings_post()
            return
        if parsed.path == "/api/runtime-state":
            self.handle_runtime_state_post()
            return
        if parsed.path == "/api/train-status":
            self.handle_train_status_post()
            return
        if parsed.path == "/api/debug/youtube-message":
            self.handle_youtube_debug_post()
            return
        if parsed.path == "/api/debug/runtime":
            self.handle_runtime_debug_post()
            return
        if parsed.path == "/api/debug/kick-viewer":
            self.handle_kick_viewer_debug_post()
            return
        if parsed.path == "/api/debug/kick-gifts":
            self.handle_debug_append(KICK_GIFTS_DEBUG_PATH)
            return
        if parsed.path == "/api/debug/youtube-paid":
            self.handle_debug_append(YOUTUBE_PAID_DEBUG_PATH)
            return
        if parsed.path == "/api/debug/gift-recipient":
            self.handle_debug_append(GIFT_RECIPIENT_DEBUG_PATH)
            return
        if parsed.path == "/api/debug/parse-failures":
            self.handle_debug_append(PARSE_FAILURE_DEBUG_PATH)
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def handle_history_get(self):
        with DB_LOCK:
            connection = sqlite3.connect(DB_PATH)
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT platform, variant, username, text, color, avatar_url, is_broadcaster,
                       timestamp_ms, badges_json, amount_text, tone, member_label, message_id, user_id,
                       gift_id, gift_name, gift_image_url, content_parts_json
                FROM messages
                ORDER BY timestamp_ms ASC, id ASC
                """
            ).fetchall()
            connection.close()

        self.send_json([row_to_message(row) for row in rows])

    def handle_history_post(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, status=HTTPStatus.BAD_REQUEST)
            return

        if is_remove_request(payload):
            self.handle_history_remove(payload)
            return

        if not is_valid_message(payload):
            self.send_json({"error": "Invalid message payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        badges_json = json.dumps(payload.get("badges", []), ensure_ascii=True)
        content_parts_json = json.dumps(payload.get("contentParts", []), ensure_ascii=True)

        with DB_LOCK:
            connection = sqlite3.connect(DB_PATH)
            if is_duplicate_message(connection, payload):
                connection.close()
                self.send_json({"status": "duplicate"})
                return

            connection.execute(
                """
                INSERT INTO messages (
                    platform, variant, username, text, color, avatar_url, is_broadcaster,
                    timestamp_ms, badges_json, amount_text, tone, member_label, message_id, user_id,
                    gift_id, gift_name, gift_image_url, content_parts_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["platform"],
                    payload.get("variant", "chat"),
                    payload["username"],
                    payload["text"],
                    payload.get("color"),
                    payload.get("avatarUrl", ""),
                    1 if payload.get("isBroadcaster") else 0,
                    int(payload["timestamp"]),
                    badges_json,
                    payload.get("amountText", ""),
                    payload.get("tone", ""),
                    payload.get("memberLabel", ""),
                    payload.get("messageId", ""),
                    payload.get("userId", ""),
                    payload.get("giftId", ""),
                    payload.get("giftName", ""),
                    payload.get("giftImageUrl", ""),
                    content_parts_json,
                ),
            )
            connection.commit()
            connection.close()

        broadcast_history_event({"type": "message", "message": payload})
        self.send_json({"status": "ok"})

    def handle_history_remove(self, payload):
        platform = str(payload.get("platform", "") or "").strip().lower()
        message_id = str(payload.get("messageId", "") or "").strip()
        if not platform or not message_id:
            self.send_json({"error": "Invalid remove payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        removed_at_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

        with DB_LOCK:
            connection = sqlite3.connect(DB_PATH)
            connection.execute(
                """
                INSERT INTO removed_messages (platform, message_id, removed_at_ms)
                VALUES (?, ?, ?)
                """,
                (platform, message_id, removed_at_ms),
            )
            connection.execute(
                """
                DELETE FROM messages
                WHERE platform = ?
                  AND message_id = ?
                """,
                (platform, message_id),
            )
            connection.commit()
            connection.close()

        broadcast_history_event({"type": "remove", "platform": platform, "messageId": message_id})
        self.send_json({"status": "ok"})

    def handle_history_stream(self):
        queue = Queue()
        with STREAM_LOCK:
            STREAM_SUBSCRIBERS.add(queue)

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        try:
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()

            while True:
                try:
                    payload = queue.get(timeout=20)
                    self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
                except Empty:
                    self.wfile.write(b": keepalive\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with STREAM_LOCK:
                STREAM_SUBSCRIBERS.discard(queue)

    def handle_settings_get(self):
        self.send_json(load_overlay_settings())

    def handle_settings_post(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, status=HTTPStatus.BAD_REQUEST)
            return

        if not isinstance(payload, dict):
            self.send_json({"error": "Invalid settings payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        settings = sanitize_overlay_settings(payload)
        save_overlay_settings(settings)
        broadcast_history_event({"type": "settings", "settings": settings})
        self.send_json({"status": "ok", "settings": settings})

    def handle_runtime_state_get(self):
        self.send_json(load_runtime_state())

    def handle_runtime_state_post(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, status=HTTPStatus.BAD_REQUEST)
            return

        if not isinstance(payload, dict):
            self.send_json({"error": "Invalid runtime payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        runtime = sanitize_runtime_state(payload)
        save_runtime_state(runtime)
        self.send_json({"status": "ok", "runtime": runtime})

    def handle_youtube_debug_get(self):
        if not YOUTUBE_DEBUG_PATH.exists():
            self.send_json([])
            return

        rows = []
        try:
            for line in YOUTUBE_DEBUG_PATH.read_text(encoding="utf-8").splitlines()[-200:]:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        except OSError:
            rows = []

        self.send_json(rows)

    def handle_youtube_debug_post(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, status=HTTPStatus.BAD_REQUEST)
            return

        if not isinstance(payload, dict):
            self.send_json({"error": "Invalid payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        payload["loggedAt"] = int(datetime.now(timezone.utc).timestamp() * 1000)
        YOUTUBE_DEBUG_PATH.parent.mkdir(parents=True, exist_ok=True)
        try:
            with YOUTUBE_DEBUG_PATH.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except OSError:
            self.send_json({"error": "Could not write debug log"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self.send_json({"status": "ok"})

    def handle_runtime_debug_get(self):
        self.send_json(load_debug_rows(RUNTIME_DEBUG_PATH))

    def handle_runtime_debug_post(self):
        self.handle_debug_append(RUNTIME_DEBUG_PATH)

    def handle_kick_viewer_debug_get(self):
        self.send_json(load_debug_rows(KICK_VIEWER_DEBUG_PATH))

    def handle_kick_viewer_debug_post(self):
        self.handle_debug_append(KICK_VIEWER_DEBUG_PATH)

    def handle_train_status_get(self):
        self.send_json(load_train_status())

    def handle_train_status_post(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, status=HTTPStatus.BAD_REQUEST)
            return

        if not isinstance(payload, dict):
            self.send_json({"error": "Invalid train status payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        status = sanitize_train_status(payload)
        save_train_status(status)
        self.send_json({"status": "ok", "train": status})

    def handle_twitch_avatar_get(self, parsed):
        params = parse_qs(parsed.query or "")
        login = first_query_value(params, "login").lower()
        user_id = first_query_value(params, "userId")
        message_id = first_query_value(params, "messageId")
        if not login:
            self.send_json({"error": "Missing login"}, status=HTTPStatus.BAD_REQUEST)
            return

        image_url, error_code = fetch_twitch_avatar_url(login)
        if error_code == "missing_credentials":
            self.send_json(
                {"error": "Set CHATBOX_TWITCH_CLIENT_ID and CHATBOX_TWITCH_ACCESS_TOKEN to enable Twitch avatar fetching."},
                status=HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        if error_code == "not_found" or not image_url:
            self.send_json({"status": "missing", "login": login, "avatarUrl": ""}, status=HTTPStatus.NOT_FOUND)
            return
        if error_code:
            self.send_json({"error": error_code}, status=HTTPStatus.BAD_GATEWAY)
            return

        persist_twitch_avatar(login, image_url, user_id=user_id, message_id=message_id)
        self.send_json({"status": "ok", "login": login, "avatarUrl": image_url})

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def handle_debug_append(self, path: Path):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, status=HTTPStatus.BAD_REQUEST)
            return

        if not isinstance(payload, dict):
            self.send_json({"error": "Invalid payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        payload["loggedAt"] = int(datetime.now(timezone.utc).timestamp() * 1000)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except OSError:
            self.send_json({"error": "Could not write debug log"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self.send_json({"status": "ok"})

    def log_message(self, fmt, *args):
        timestamp = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {self.address_string()} - {fmt % args}")


def is_valid_message(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False

    for key in ("platform", "username", "text"):
        if not isinstance(payload.get(key), str) or not payload.get(key):
            return False

    if not isinstance(payload.get("timestamp"), int):
        return False

    variant = payload.get("variant", "chat")
    if not isinstance(variant, str):
        return False

    badges = payload.get("badges", [])
    if not isinstance(badges, list) or any(not isinstance(item, str) for item in badges):
        return False

    content_parts = payload.get("contentParts", [])
    if not isinstance(content_parts, list):
        return False
    for part in content_parts:
        if not isinstance(part, dict):
            return False
        if not isinstance(part.get("type"), str):
            return False
        if part.get("type") == "text" and not isinstance(part.get("text", ""), str):
            return False
        if part.get("type") == "emote" and not isinstance(part.get("imageUrl", ""), str):
            return False

    for key in ("giftId", "giftName", "giftImageUrl"):
        if key in payload and not isinstance(payload.get(key), str):
            return False

    return True


def is_remove_request(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    return str(payload.get("type", "") or "").strip().lower() == "remove"


def first_query_value(query: dict, key: str) -> str:
    values = query.get(key, [])
    if not values:
        return ""
    return str(values[0] or "").strip()


def is_duplicate_message(connection: sqlite3.Connection, payload: dict) -> bool:
    message_id = str(payload.get("messageId", "") or "").strip()
    if message_id:
        removed_row = connection.execute(
            """
            SELECT id
            FROM removed_messages
            WHERE platform = ?
              AND message_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (payload["platform"], message_id),
        ).fetchone()
        if removed_row is not None:
            return True

        row = connection.execute(
            """
            SELECT id
            FROM messages
            WHERE platform = ?
              AND message_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (payload["platform"], message_id),
        ).fetchone()
        if row is not None:
            return True

    row = connection.execute(
        """
        SELECT id
        FROM messages
        WHERE platform = ?
          AND variant = ?
          AND username = ?
          AND text = ?
          AND COALESCE(amount_text, '') = ?
          AND COALESCE(tone, '') = ?
          AND ABS(timestamp_ms - ?) <= 1000
        ORDER BY id DESC
        LIMIT 1
        """,
        (
            payload["platform"],
            payload.get("variant", "chat"),
            payload["username"],
            payload["text"],
            payload.get("amountText", ""),
            payload.get("tone", ""),
            int(payload["timestamp"]),
        ),
    ).fetchone()
    return row is not None


def broadcast_history_event(payload: dict) -> None:
    message = json.dumps(payload, ensure_ascii=True)
    with STREAM_LOCK:
        subscribers = list(STREAM_SUBSCRIBERS)
    for queue in subscribers:
        queue.put(message)


def load_debug_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []

    rows = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines()[-200:]:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    except OSError:
        return []

    return rows


def load_overlay_settings() -> dict:
    try:
        raw = SETTINGS_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except OSError:
        return {}

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    if not isinstance(payload, dict):
        return {}
    return sanitize_overlay_settings(payload)


def save_overlay_settings(settings: dict) -> None:
    SETTINGS_PATH.write_text(
        json.dumps(sanitize_overlay_settings(settings), ensure_ascii=True),
        encoding="utf-8",
    )


def load_runtime_state() -> dict:
    try:
        raw = RUNTIME_STATE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except OSError:
        return {}

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    if not isinstance(payload, dict):
        return {}
    return sanitize_runtime_state(payload)


def save_runtime_state(runtime: dict) -> None:
    RUNTIME_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_STATE_PATH.write_text(
        json.dumps(sanitize_runtime_state(runtime), ensure_ascii=True),
        encoding="utf-8",
    )


def load_train_status() -> dict:
    try:
        raw = TRAIN_STATUS_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return sanitize_train_status({})
    except OSError:
        return sanitize_train_status({})

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return sanitize_train_status({})

    if not isinstance(payload, dict):
        return sanitize_train_status({})
    return sanitize_train_status(payload)


def save_train_status(status: dict) -> None:
    sanitized = sanitize_train_status(status)
    TRAIN_STATUS_PATH.write_text(
        json.dumps(sanitized, ensure_ascii=True),
        encoding="utf-8",
    )
    TRAIN_ACTIVE_PATH.write_text("1" if sanitized["active"] else "0", encoding="utf-8")


def sanitize_train_status(payload: dict) -> dict:
    def safe_int(value: object, minimum: int = 0) -> int:
        try:
            numeric = int(value)
        except (TypeError, ValueError):
            return minimum
        return max(minimum, numeric)

    active = bool(payload.get("active"))
    status = {
        "active": active,
        "level": safe_int(payload.get("level"), 0),
        "platform": str(payload.get("platform", "") or "").strip().lower(),
        "points": safe_int(payload.get("points"), 0),
        "eventCount": safe_int(payload.get("eventCount"), 0),
        "lastContributor": str(payload.get("lastContributor", "") or "").strip(),
        "lastContributionLabel": str(payload.get("lastContributionLabel", "") or "").strip(),
        "expiresAt": safe_int(payload.get("expiresAt"), 0),
    }

    if not status["active"]:
        status["level"] = 0
        status["points"] = 0
        status["eventCount"] = 0
        status["lastContributor"] = ""
        status["lastContributionLabel"] = ""
        status["expiresAt"] = 0

    return status


def sanitize_overlay_settings(payload: dict) -> dict:
    def normalize_username(value: object) -> str:
        return str(value or "").strip().lstrip("@").lower()

    def sanitize_user_list(values: object) -> list[str]:
        if not isinstance(values, list):
            return []
        normalized = []
        for value in values:
            item = normalize_username(value)
            if item:
                normalized.append(item)
        return normalized

    def safe_int(value: object, fallback: int, minimum: int, maximum: int) -> int:
        try:
            numeric = int(value)
        except (TypeError, ValueError):
            numeric = fallback
        return max(minimum, min(maximum, numeric))

    def safe_float(value: object, fallback: float, minimum: float, maximum: float) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = fallback
        return max(minimum, min(maximum, numeric))

    return {
        "streamLiteEffects": bool(payload.get("streamLiteEffects", payload.get("liteEffects"))),
        "dockLiteEffects": bool(payload.get("dockLiteEffects", payload.get("liteEffects"))),
        "streamShowFollowAlerts": payload.get("streamShowFollowAlerts", payload.get("showFollowAlerts", True)) is not False,
        "dockShowFollowAlerts": payload.get("dockShowFollowAlerts", payload.get("showFollowAlerts", True)) is not False,
        "streamIgnoreBangCommands": bool(payload.get("streamIgnoreBangCommands", payload.get("ignoreBangCommands"))),
        "dockIgnoreBangCommands": bool(payload.get("dockIgnoreBangCommands", payload.get("ignoreBangCommands"))),
        "streamHideDeletedMessages": bool(payload.get("streamHideDeletedMessages", payload.get("hideDeletedMessages"))),
        "dockHideDeletedMessages": bool(payload.get("dockHideDeletedMessages")),
        "streamShowStatus": payload.get("streamShowStatus", False) is not False,
        "dockShowStatus": payload.get("dockShowStatus", payload.get("showStatus", True)) is not False,
        "ignoreUsersStream": sanitize_user_list(payload.get("ignoreUsersStream")),
        "ignoreUsersDock": sanitize_user_list(payload.get("ignoreUsersDock")),
        "trainPosition": str(payload.get("trainPosition", "bottom-left") or "").strip().lower() if str(payload.get("trainPosition", "bottom-left") or "").strip().lower() in {"top-left", "bottom-left", "bottom-center"} else "bottom-left",
        "trainWidth": safe_int(payload.get("trainWidth", 860), 860, 320, 2400),
        "trainScale": safe_float(payload.get("trainScale", 1), 1.0, 0.4, 2.5),
        "trainCompact": bool(payload.get("trainCompact")),
    }


def sanitize_runtime_state(payload: dict) -> dict:
    def safe_int(value: object, fallback: int = 0, minimum: int = 0) -> int:
        try:
            numeric = int(value)
        except (TypeError, ValueError):
            numeric = fallback
        return max(minimum, numeric)

    result = {}
    for key, value in payload.items():
        if not isinstance(key, str) or not isinstance(value, dict):
            continue
        platform_key = key.strip().lower()
        if not platform_key:
            continue
        viewer_count = value.get("viewerCount")
        if viewer_count is not None:
            try:
                viewer_count = max(0, int(viewer_count))
            except (TypeError, ValueError):
                viewer_count = None
        result[platform_key] = {
            "connected": bool(value.get("connected")),
            "accountConnected": bool(value.get("accountConnected")),
            "chatConfirmed": bool(value.get("chatConfirmed")),
            "label": str(value.get("label", "") or "").strip(),
            "tone": str(value.get("tone", "") or "").strip(),
            "lastMessageAt": safe_int(value.get("lastMessageAt"), 0, 0),
            "viewerCount": viewer_count,
        }
    return result


def fetch_twitch_avatar_url(login: str):
    if not login:
        return "", "missing_login"

    cached = TWITCH_AVATAR_CACHE.get(login)
    now = time.time()
    if cached and now - cached["timestamp"] < TWITCH_AVATAR_CACHE_TTL_SEC:
        return cached["avatar_url"], None

    client_id = os.environ.get("CHATBOX_TWITCH_CLIENT_ID", "").strip()
    access_token = os.environ.get("CHATBOX_TWITCH_ACCESS_TOKEN", "").strip()
    if not client_id or not access_token:
        return "", "missing_credentials"

    request = Request(
        f"https://api.twitch.tv/helix/users?login={quote(login)}",
        headers={
            "Client-Id": client_id,
            "Authorization": f"Bearer {access_token}",
        },
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        return "", f"twitch_lookup_failed: {error}"

    users = payload.get("data", [])
    if not users:
        return "", "not_found"

    avatar_url = str(users[0].get("profile_image_url") or "").strip()
    if avatar_url:
        TWITCH_AVATAR_CACHE[login] = {
            "avatar_url": avatar_url,
            "timestamp": now,
        }
    return avatar_url, None


def persist_twitch_avatar(login: str, avatar_url: str, user_id: str = "", message_id: str = "") -> None:
    if not login or not avatar_url:
        return

    with DB_LOCK:
        connection = sqlite3.connect(DB_PATH)
        if user_id:
            connection.execute(
                """
                UPDATE messages
                SET avatar_url = ?
                WHERE platform = 'twitch'
                  AND user_id = ?
                """,
                (avatar_url, user_id),
            )
        elif message_id:
            connection.execute(
                """
                UPDATE messages
                SET avatar_url = ?
                WHERE platform = 'twitch'
                  AND message_id = ?
                """,
                (avatar_url, message_id),
            )
        else:
            connection.execute(
                """
                UPDATE messages
                SET avatar_url = ?
                WHERE platform = 'twitch'
                  AND lower(username) = ?
                """,
                (avatar_url, login),
            )
        connection.commit()
        connection.close()


def main():
    init_db()
    bind_host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8934
    server = ThreadingHTTPServer((bind_host, port), OverlayHandler)
    print(f"Serving overlay on http://{bind_host}:{port} from {ROOT}")
    print(f"History database: {DB_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
