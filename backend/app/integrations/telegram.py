"""Private-chat Telegram adapter. Run separately: python -m app.integrations.telegram."""

from contextlib import contextmanager
import asyncio
import json
import logging
import os
import sqlite3
import time
import httpx
from app.core.config import settings
from app.core.telegram_identity import issue

HELP = "WetinNext commands:\n/start — setup or resume\n/plan — this week’s task\n/matches — opportunities and resources\n/done, /stuck, /moretime — check in\n/cancel — cancel setup\n/privacy — data use\n/forget — delete this bot profile\n/help — commands"
PRIVACY = "Your goal, country, time, device and check-ins are stored in your bot profile. If configured, OpenAI receives goal/constraints and practice signals. Telegram also processes your messages. Avoid sensitive details. CV files are not accepted here. This profile is separate from your web account. /forget deletes WetinNext’s bot profile; it does not remove messages stored by Telegram."


class StateStore:
    def __init__(self, path):
        self.path = path
        with self.connect() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, state TEXT)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS replies (id INTEGER PRIMARY KEY, text TEXT, chat TEXT)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS cursor (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER)"
            )
        os.chmod(path, 0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()

    def state(self, chat):
        with self.connect() as db:
            row = db.execute(
                "SELECT state FROM chats WHERE id=?", (str(chat),)
            ).fetchone()
        return json.loads(row[0]) if row else {}

    def save(self, chat, state):
        with self.connect() as db:
            db.execute(
                "INSERT INTO chats VALUES (?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state",
                (str(chat), json.dumps(state)),
            )

    def reply(self, update):
        with self.connect() as db:
            return db.execute(
                "SELECT text FROM replies WHERE id=?", (update,)
            ).fetchone()

    def remember(self, update, text, chat=None):
        with self.connect() as db:
            db.execute(
                "INSERT OR REPLACE INTO replies VALUES (?,?,?)",
                (update, text, str(chat)),
            )
            db.execute(
                "DELETE FROM replies WHERE id NOT IN (SELECT id FROM replies ORDER BY id DESC LIMIT 1000)"
            )

    def forget(self, chat):
        with self.connect() as db:
            db.execute("DELETE FROM chats WHERE id=?", (str(chat),))
            db.execute("DELETE FROM replies WHERE chat=?", (str(chat),))

    def offset(self):
        with self.connect() as db:
            row = db.execute("SELECT value FROM cursor WHERE id=1").fetchone()
        return row[0] if row else 0

    def advance(self, update):
        with self.connect() as db:
            db.execute(
                "INSERT INTO cursor VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=MAX(value,excluded.value)",
                (update + 1,),
            )


class Bot:
    def __init__(self, store, rest=None):
        self.store = store
        self.rest = rest or self.request

    async def request(self, user, path, method="GET", payload=None):
        async with httpx.AsyncClient(timeout=40) as client:
            response = await client.request(
                method,
                settings.gateway_service_url.rstrip("/") + "/api/v1" + path,
                headers={"Authorization": "Telegram " + issue(user)},
                json=payload,
            )
            if response.is_error:
                detail = response.json().get("detail", "Service unavailable")
                raise ValueError(
                    detail if isinstance(detail, str) else "Please check your details"
                )
            return response.json()

    async def handle(self, user, text, update_id=None):
        text = text.strip()[:1000]
        command = text.split(" ", 1)[0].split("@", 1)[0].lower()
        state = self.store.state(user)
        if command in ["/help", "/privacy"]:
            return HELP if command == "/help" else PRIVACY
        if command == "/cancel":
            self.store.save(user, {})
            return "Setup cancelled. Your saved plan is unchanged. /start to resume."
        if command == "/forget":
            self.store.save(user, {"step": "delete"})
            return "Delete your WetinNext bot profile and progress? Reply /confirmdelete or /cancel."
        if command == "/confirmdelete" and state.get("step") == "delete":
            await self.rest(user, "/me", "DELETE")
            self.store.forget(user)
            return "Your WetinNext bot profile was deleted. Telegram may retain chat messages. /start to begin again."
        if command == "/start":
            me = await self.rest(user, "/me")
            if me.get("plan"):
                return await self.plan(user)
            self.store.save(user, {"step": "goal"})
            return (
                "Welcome to WetinNext. "
                + PRIVACY
                + "\n\nWhat would you like to work towards? (5–500 characters)"
            )
        if state.get("step") == "goal" and not text.startswith("/"):
            if not 5 <= len(text) <= 500:
                return "Describe your goal in 5–500 characters."
            state.update(goal=text, step="country")
            self.store.save(user, state)
            return "Where are you based? Reply Nigeria or Rwanda."
        if state.get("step") == "country" and not text.startswith("/"):
            country = {"nigeria": "Nigeria", "rwanda": "Rwanda"}.get(text.lower())
            if not country:
                return "Reply Nigeria or Rwanda."
            state.update(country=country, step="hours")
            self.store.save(user, state)
            return "How many hours can you study each week? Reply 1–20."
        if state.get("step") == "hours" and not text.startswith("/"):
            if not text.isdigit() or not 1 <= int(text) <= 20:
                return "Reply with a whole number from 1 to 20."
            state.update(hours=int(text), step="device")
            self.store.save(user, state)
            return "Your main device: phone or laptop?"
        if state.get("step") == "device" and not text.startswith("/"):
            if text.lower() not in ["phone", "laptop"]:
                return "Reply phone or laptop."
            state.update(device=text.lower(), step="confirm")
            self.store.save(user, state)
            return f"Goal: {state['goal']}\n{state['country']} · {state['hours']} hours/week · {state['device']}\nReply /confirm to create your first four-week sprint, or /cancel. Four weeks is a starting project, not a job-readiness promise."
        if command == "/confirm" and state.get("step") == "confirm":
            me = await self.rest(user, "/me")
            if not me.get("plan"):
                await self.rest(
                    user,
                    "/me/profile",
                    "PUT",
                    {
                        "name": "Telegram learner",
                        "goal": state["goal"],
                        "country": state["country"],
                        "hours": state["hours"],
                        "device": state["device"],
                        "learner_type": "self-taught",
                        "low_data": True,
                        "career_track": "auto",
                    },
                )
            self.store.save(user, {})
            return await self.plan(user)
        if command == "/plan":
            return await self.plan(user)
        if command == "/matches":
            me = await self.rest(user, "/me")
            if not me.get("plan"):
                return "Set your goal first with /start."
            if time.time() - state.get("matches_at", 0) < 30:
                return "Please wait a little before refreshing. Your previous matches remain in this chat."
            result = await self.rest(user, "/recommendations")
            self.store.save(user, {**state, "matches_at": time.time()})
            lines = [
                (
                    "OpenAI guidance"
                    if result.get("engine") == "OpenAI"
                    else "Catalogue guidance · AI unavailable or not configured"
                )
            ]
            for match in result.get("opportunities", [])[:2]:
                item = match["opportunity"]
                lines.append(
                    f"\n{'Practice: ' if item.get('sample') else ''}{item['title']} — {item['organisation']}\nSource: {item.get('source') or 'Practice catalogue'}\n{item.get('url') or 'No real application link'}\nNext: {match.get('next_action') or 'Review the requirements and prepare evidence.'}"
                )
            for match in result.get("resources", [])[:2]:
                item = match["resource"]
                lines.append(
                    f"\nLearn: {item['title']} ({item['provider']})\n{item['url']}"
                )
            if not result.get("opportunities"):
                lines.append(
                    "No matching published jobs yet; keep building evidence with the resources."
                )
            lines.append(
                "Confirm location eligibility and availability on the original source."
            )
            return "\n".join(lines)[:3900]
        if command in ["/done", "/stuck", "/moretime"]:
            me = await self.rest(user, "/me")
            week = next(
                (
                    w
                    for w in (me.get("plan") or {}).get("weeks", [])
                    if me.get("progress", {}).get(str(w["week"]), {}).get("status")
                    != "done"
                ),
                None,
            )
            if not week:
                return (
                    "No active task. /start to set up, or /plan to review your sprint."
                )
            pending = state.get("pending_checkin", {})
            if update_id is not None and pending.get("update_id") == update_id:
                week = {"week": pending["week"]}
            else:
                self.store.save(
                    user,
                    {
                        **state,
                        "pending_checkin": {
                            "update_id": update_id,
                            "week": week["week"],
                        },
                    },
                )
            result = await self.rest(
                user,
                f"/weeks/{week['week']}/check-in",
                "POST",
                {
                    "status": {
                        "/done": "done",
                        "/stuck": "stuck",
                        "/moretime": "more-time",
                    }[command],
                    "note": text.partition(" ")[2][:1000],
                },
            )
            return result["advice"] + "\n/plan for your current task."
        return "Use /start to set up, /plan for your task, or /matches for resources and jobs. /help for commands."

    async def plan(self, user):
        me = await self.rest(user, "/me")
        plan = me.get("plan")
        if not plan:
            return "No plan yet. Use /start."
        week = next(
            (
                w
                for w in plan["weeks"]
                if me.get("progress", {}).get(str(w["week"]), {}).get("status")
                != "done"
            ),
            None,
        )
        if not week:
            return "Your first sprint is complete. Keep your project evidence and use /matches for the next opportunity."
        resources = await self.rest(user, "/resources")
        resource = next((r for r in resources if r["id"] == week["resource_id"]), {})
        return f"Week {week['week']}: {week['title']}\n{week['task']}\nTime: {week['minutes']} min\nSuccess: {week['success']}\n{resource.get('url', 'Resource unavailable')}\n{plan.get('notice', '')}\n\n/done · /stuck · /moretime · /matches"[
            :3900
        ]


async def telegram(client, method, payload):
    response = await client.post(
        f"https://api.telegram.org/bot{settings.telegram_bot_token}/{method}",
        json=payload,
    )
    body = response.json()
    if not response.is_success or not body.get("ok"):
        raise RuntimeError("Telegram request failed")
    return body.get("result")


async def run():
    if not settings.telegram_bot_token or len(settings.telegram_service_secret) < 32:
        raise SystemExit(
            "Set TELEGRAM_BOT_TOKEN and TELEGRAM_SERVICE_SECRET in backend/.env before starting the bot."
        )
    store = StateStore(settings.telegram_state_database)
    bot = Bot(store)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    async with httpx.AsyncClient(timeout=40) as client:
        info = await telegram(client, "getWebhookInfo", {})
        if info.get("url"):
            raise SystemExit(
                "A webhook is active. Remove it deliberately before using this polling worker."
            )
        logging.info("Telegram polling worker started")
        while True:
            try:
                updates = await telegram(
                    client,
                    "getUpdates",
                    {
                        "offset": store.offset(),
                        "timeout": 25,
                        "limit": 20,
                        "allowed_updates": ["message"],
                    },
                )
                for update in updates:
                    uid = update["update_id"]
                    message = update.get("message", {})
                    chat = message.get("chat", {})
                    sender = message.get("from", {})
                    if (
                        chat.get("type") != "private"
                        or sender.get("is_bot")
                        or chat.get("id") != sender.get("id")
                    ):
                        store.advance(uid)
                        continue
                    cached = store.reply(uid)
                    if cached:
                        reply = cached[0]
                    else:
                        try:
                            reply = await bot.handle(
                                sender["id"], message.get("text") or "/help", uid
                            )
                        except (httpx.HTTPError, ValueError, KeyError):
                            reply = "The service could not complete that request. Please retry your command shortly."
                        store.remember(uid, reply, chat["id"])
                    await telegram(
                        client,
                        "sendMessage",
                        {
                            "chat_id": chat["id"],
                            "text": reply,
                            "link_preview_options": {"is_disabled": True},
                        },
                    )
                    store.advance(uid)
            except (httpx.HTTPError, RuntimeError, ValueError, KeyError):
                logging.warning(
                    "Telegram transport unavailable; retrying without logging message content or credentials"
                )
                await asyncio.sleep(5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
    except (httpx.HTTPError, RuntimeError, ValueError):
        raise SystemExit(
            "Telegram connection failed. Check server configuration; credentials have not been logged."
        )
