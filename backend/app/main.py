import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

from flask import Flask, jsonify, request, render_template
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    login_required,
    logout_user,
    current_user,
)
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from backend.db.mongo_client import db


load_dotenv()

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEMPLATE_DIR = os.path.join(PROJECT_ROOT, "templates")
STATIC_DIR = os.path.join(PROJECT_ROOT, "static")

app = Flask(
    __name__,
    template_folder=TEMPLATE_DIR,
    static_folder=STATIC_DIR,
    static_url_path="/static",
)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret")

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "unauthorized"


class MongoUser(UserMixin):
    def __init__(self, doc):
        self.id = str(doc["_id"])
        self.username = doc.get("username")
        self.email = doc.get("email")

    @staticmethod
    def get(user_id):
        doc = db.users.find_one({"_id": ObjectId(user_id)})
        return MongoUser(doc) if doc else None


@login_manager.user_loader
def load_user(user_id):
    return MongoUser.get(user_id)


def get_payload():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict()


def safe_user(doc):
    return {
        "_id": str(doc["_id"]),
        "username": doc.get("username"),
        "email": doc.get("email"),
        "created_at": doc.get("created_at"),
    }


# routes
@app.route("/")
def home():
    """Render the top-level index page from project templates/"""
    return render_template("index.html")


@app.route("/auth/register", methods=["POST"])
def register():
    data = get_payload()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not username or not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    if db.users.find_one({"email": email}) or db.users.find_one({"username": username}):
        return jsonify({"error": "user already exists"}), 409

    hashed_pw = generate_password_hash(password, method="pbkdf2:sha256")
    user_doc = {
        "username": username,
        "email": email,
        "password": hashed_pw,
        "friends": [],
        "created_at": datetime.utcnow().isoformat(),
    }
    result = db.users.insert_one(user_doc)
    new_user = db.users.find_one({"_id": result.inserted_id})

    login_user(MongoUser(new_user))
    return jsonify({"message": "registered", "user": safe_user(new_user)}), 201


@app.route("/auth/login", methods=["POST"])
def login():
    data = get_payload()
    email_or_username = data.get("email") or data.get("username")
    password = data.get("password", "")

    user = db.users.find_one(
        {"$or": [{"email": email_or_username}, {"username": email_or_username}]}
    )

    if not user:
        return jsonify({"error": "invalid credentials"}), 401

    password_valid = False
    try:
        password_valid = check_password_hash(user["password"], password)
    except AttributeError as e:

        print(f"Password verification failed due to scrypt error: {e}")

        return (
            jsonify(
                {"error": "Password verification failed. Please reset your password."}
            ),
            500,
        )

    if not password_valid:
        return jsonify({"error": "invalid credentials"}), 401

    login_user(MongoUser(user))
    return jsonify({"message": "logged in", "user": safe_user(user)}), 200


@app.route("/auth/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "logged out"}), 200


@app.route("/auth/me", methods=["GET"])
@login_required
def me():
    user_doc = db.users.find_one({"_id": ObjectId(current_user.id)})
    return jsonify({"user": safe_user(user_doc)}), 200


@app.route("/sign-up")
def signup():
    """Render the signup page"""
    return render_template("signup.html")


@app.route("/home")
@login_required
def home_page():
    """Render the home page after successful login"""
    return render_template("home.html")


@app.route("/logout")
def logout_page():
    """Logout user and redirect to index"""
    logout_user()
    return render_template("index.html")


@app.route("/unauthorized")
def unauthorized():
    """Handle unauthorized access attempts"""
    return render_template("403.html"), 403


@app.route("/<path:path>")
def catch_all(path):
    """Catch all routes that don't exist"""
    return render_template("404.html"), 404


@app.route("/history")
@login_required
def history():
    """Render the history page"""
    return render_template("history.html")


@app.route("/social")
@login_required
def social():
    """Render the social page"""
    return render_template("social.html")


@app.route("/api/sessions", methods=["GET"])
@login_required
def get_sessions():
    """Get all sessions for the current user"""
    sessions = list(
        db.sessions.find({"user_id": ObjectId(current_user.id)}).sort("created_at", -1)
    )
    return jsonify(
        [
            {
                "_id": str(session["_id"]),
                "title": session.get("title", ""),
                "date": session.get("date", ""),
                "duration": session.get("duration", 0),
                "type": session.get("type", ""),
                "notes": session.get("notes", ""),
                "created_at": session.get("created_at", ""),
            }
            for session in sessions
        ]
    )


@app.route("/api/sessions", methods=["POST"])
@login_required
def create_session():
    """Create a new session"""
    data = get_payload()

    session_doc = {
        "user_id": ObjectId(current_user.id),
        "title": data.get("title", ""),
        "date": data.get("date", ""),
        "duration": int(data.get("duration", 0)),
        "type": data.get("type", ""),
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
    }

    result = db.sessions.insert_one(session_doc)
    new_session = db.sessions.find_one({"_id": result.inserted_id})

    return (
        jsonify(
            {
                "_id": str(new_session["_id"]),
                "title": new_session.get("title", ""),
                "date": new_session.get("date", ""),
                "duration": new_session.get("duration", 0),
                "type": new_session.get("type", ""),
                "notes": new_session.get("notes", ""),
                "created_at": new_session.get("created_at", ""),
            }
        ),
        201,
    )


@app.route("/api/sessions/<session_id>", methods=["PUT"])
@login_required
def update_session(session_id):
    """Update an existing session"""
    data = get_payload()

    session = db.sessions.find_one(
        {"_id": ObjectId(session_id), "user_id": ObjectId(current_user.id)}
    )

    if not session:
        return jsonify({"error": "Session not found"}), 404

    update_data = {
        "title": data.get("title", session.get("title", "")),
        "date": data.get("date", session.get("date", "")),
        "duration": int(data.get("duration", session.get("duration", 0))),
        "type": data.get("type", session.get("type", "")),
        "notes": data.get("notes", session.get("notes", "")),
    }

    db.sessions.update_one({"_id": ObjectId(session_id)}, {"$set": update_data})

    updated_session = db.sessions.find_one({"_id": ObjectId(session_id)})
    return jsonify(
        {
            "_id": str(updated_session["_id"]),
            "title": updated_session.get("title", ""),
            "date": updated_session.get("date", ""),
            "duration": updated_session.get("duration", 0),
            "type": updated_session.get("type", ""),
            "notes": updated_session.get("notes", ""),
            "created_at": updated_session.get("created_at", ""),
        }
    )


@app.route("/api/sessions/<session_id>", methods=["DELETE"])
@login_required
def delete_session(session_id):
    """Delete a session"""

    session = db.sessions.find_one(
        {"_id": ObjectId(session_id), "user_id": ObjectId(current_user.id)}
    )

    if not session:
        return jsonify({"error": "Session not found"}), 404

    db.sessions.delete_one({"_id": ObjectId(session_id)})
    return jsonify({"message": "Session deleted"}), 200


@app.route("/api/friends", methods=["GET"])
@login_required
def get_friends():
    """Get user's friends and friend requests"""
    user_id = ObjectId(current_user.id)

    user = db.users.find_one({"_id": user_id})
    friend_ids = [ObjectId(friend_id) for friend_id in user.get("friends", [])]
    friends = list(db.users.find({"_id": {"$in": friend_ids}}))

    for friend in friends:
        sessions = list(db.sessions.find({"user_id": friend["_id"], "type": "work"}))
        friend["totalMinutes"] = sum(session.get("duration", 0) for session in sessions)

    requests = list(
        db.friend_requests.find({"to_user_id": user_id, "status": "pending"})
    )

    for request in requests:
        requester = db.users.find_one({"_id": request["from_user_id"]})
        request["from"] = {
            "username": requester.get("username"),
            "email": requester.get("email"),
        }

    return jsonify(
        {
            "friends": [
                {
                    "_id": str(friend["_id"]),
                    "username": friend.get("username"),
                    "totalMinutes": friend.get("totalMinutes", 0),
                }
                for friend in friends
            ],
            "requests": [
                {
                    "_id": str(request["_id"]),
                    "from": request["from"],
                    "created_at": request.get("created_at"),
                }
                for request in requests
            ],
        }
    )


@app.route("/api/friends/request", methods=["POST"])
@login_required
def send_friend_request():
    """Send a friend request"""
    data = get_payload()
    username = data.get("username", "").strip()

    if not username:
        return jsonify({"error": "Username is required"}), 400

    target_user = db.users.find_one(
        {"$or": [{"username": username}, {"email": username}]}
    )

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    if target_user["_id"] == ObjectId(current_user.id):
        return jsonify({"error": "Cannot add yourself as a friend"}), 400

    # Check if already friends
    current_user_doc = db.users.find_one({"_id": ObjectId(current_user.id)})
    if str(target_user["_id"]) in current_user_doc.get("friends", []):
        return jsonify({"error": "Already friends with this user"}), 400

    existing_request = db.friend_requests.find_one(
        {
            "from_user_id": ObjectId(current_user.id),
            "to_user_id": target_user["_id"],
            "status": "pending",
        }
    )

    if existing_request:
        return jsonify({"error": "Friend request already sent"}), 400

    # Create friend request
    request_doc = {
        "from_user_id": ObjectId(current_user.id),
        "to_user_id": target_user["_id"],
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }

    db.friend_requests.insert_one(request_doc)
    return jsonify({"message": "Friend request sent"}), 201


@app.route("/api/friends/request/<request_id>", methods=["PUT"])
@login_required
def respond_to_friend_request(request_id):
    """Accept or decline a friend request"""
    data = get_payload()
    action = data.get("action")

    if action not in ["accept", "decline"]:
        return jsonify({"error": "Invalid action"}), 400

    request = db.friend_requests.find_one(
        {
            "_id": ObjectId(request_id),
            "to_user_id": ObjectId(current_user.id),
            "status": "pending",
        }
    )

    if not request:
        return jsonify({"error": "Request not found"}), 404

    if action == "accept":
        db.users.update_one(
            {"_id": ObjectId(current_user.id)},
            {"$addToSet": {"friends": str(request["from_user_id"])}},
        )
        db.users.update_one(
            {"_id": request["from_user_id"]},
            {"$addToSet": {"friends": str(ObjectId(current_user.id))}},
        )

    db.friend_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "accepted" if action == "accept" else "declined"}},
    )

    return jsonify({"message": f"Friend request {action}ed"}), 200


@app.route("/api/friends/<friend_id>", methods=["DELETE"])
@login_required
def remove_friend(friend_id):
    """Remove a friend"""

    db.users.update_one(
        {"_id": ObjectId(current_user.id)}, {"$pull": {"friends": friend_id}}
    )
    db.users.update_one(
        {"_id": ObjectId(friend_id)},
        {"$pull": {"friends": str(ObjectId(current_user.id))}},
    )

    return jsonify({"message": "Friend removed"}), 200


@app.route("/api/leaderboard", methods=["GET"])
@login_required
def get_leaderboard():
    """Get study leaderboard"""

    users = list(db.users.find({}))
    leaderboard = []

    for user in users:
        sessions = list(db.sessions.find({"user_id": user["_id"], "type": "work"}))
        total_minutes = sum(session.get("duration", 0) for session in sessions)

        leaderboard.append(
            {
                "_id": str(user["_id"]),
                "username": user.get("username"),
                "totalMinutes": total_minutes,
            }
        )

    leaderboard.sort(key=lambda x: x["totalMinutes"], reverse=True)

    return jsonify(leaderboard[:50])


@app.route("/api/timer/start", methods=["POST"])
@login_required
def start_timer():
    """Start a server-side timer"""
    data = get_payload()
    user_id = ObjectId(current_user.id)

    # Remove any existing timer for this user
    db.active_timers.delete_many({"user_id": user_id})

    timer_data = {
        "user_id": user_id,
        "start_time": datetime.utcnow().isoformat(),
        "duration": int(data.get("duration", 25)) * 60,
        "is_work_session": data.get("is_work_session", True),
        "current_interval": int(data.get("current_interval", 0)),
        "total_intervals": int(data.get("total_intervals", 4)),
        "paused": False,
        "created_at": datetime.utcnow().isoformat(),
    }

    result = db.active_timers.insert_one(timer_data)
    timer_data["_id"] = str(result.inserted_id)
    timer_data["user_id"] = str(timer_data["user_id"])
    return jsonify({"message": "Timer started", "timer": timer_data})


@app.route("/api/timer/status", methods=["GET"])
@login_required
def get_timer_status():
    """Get current timer status"""
    user_id = ObjectId(current_user.id)

    timer = db.active_timers.find_one({"user_id": user_id})
    if not timer:
        return jsonify({"error": "No active timer"}), 404

    if timer.get("paused"):
        paused_at = datetime.fromisoformat(timer["paused_at"])
        start_time = datetime.fromisoformat(timer["start_time"])
        elapsed = (paused_at - start_time).total_seconds()
        remaining = max(0, timer["duration"] - elapsed)
    else:
        start_time = datetime.fromisoformat(timer["start_time"])
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        remaining = max(0, timer["duration"] - elapsed)

    return jsonify(
        {
            "remaining_time": int(remaining),
            "is_work_session": timer["is_work_session"],
            "current_interval": timer["current_interval"],
            "total_intervals": timer["total_intervals"],
            "is_complete": remaining <= 0,
            "is_paused": timer.get("paused", False),
        }
    )


@app.route("/api/timer/pause", methods=["POST"])
@login_required
def pause_timer():
    """Pause the server-side timer"""
    user_id = ObjectId(current_user.id)

    result = db.active_timers.update_one(
        {"user_id": user_id},
        {"$set": {"paused": True, "paused_at": datetime.utcnow().isoformat()}},
    )

    if result.matched_count == 0:
        return jsonify({"error": "No active timer found"}), 404

    return jsonify({"message": "Timer paused"})


@app.route("/api/timer/resume", methods=["POST"])
@login_required
def resume_timer():
    """Resume the server-side timer"""
    user_id = ObjectId(current_user.id)

    timer = db.active_timers.find_one({"user_id": user_id})
    if not timer or not timer.get("paused"):
        return jsonify({"error": "No paused timer found"}), 404

    paused_at = datetime.fromisoformat(timer["paused_at"])
    paused_duration = (datetime.utcnow() - paused_at).total_seconds()

    original_start = datetime.fromisoformat(timer["start_time"])
    new_start_time = (original_start + timedelta(seconds=paused_duration)).isoformat()

    db.active_timers.update_one(
        {"user_id": user_id},
        {
            "$set": {"start_time": new_start_time, "paused": False},
            "$unset": {"paused_at": ""},
        },
    )

    return jsonify({"message": "Timer resumed"})


@app.route("/api/timer/stop", methods=["POST"])
@login_required
def stop_timer():
    """Stop the server-side timer"""
    user_id = ObjectId(current_user.id)

    result = db.active_timers.delete_many({"user_id": user_id})

    if result.deleted_count == 0:
        return jsonify({"error": "No active timer found"}), 404

    return jsonify({"message": "Timer stopped"})


@app.route("/api/timer/complete", methods=["POST"])
@login_required
def complete_timer():
    """Mark timer as completed and save session"""
    user_id = ObjectId(current_user.id)

    # Get timer data before deleting
    timer = db.active_timers.find_one({"user_id": user_id})
    if not timer:
        return jsonify({"error": "No active timer found"}), 404

    # Save completed session to history
    session_doc = {
        "user_id": user_id,
        "title": f"{'Study' if timer['is_work_session'] else 'Break'} Session",
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "duration": timer["duration"] // 60,  # Convert back to minutes
        "type": "work" if timer["is_work_session"] else "break",
        "notes": f"Completed {timer['duration'] // 60} minute session",
        "created_at": datetime.utcnow().isoformat(),
    }

    db.sessions.insert_one(session_doc)

    # Remove from active timers
    db.active_timers.delete_many({"user_id": user_id})

    return jsonify({"message": "Timer completed and saved"})


# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors"""
    return render_template("404.html"), 404


@app.errorhandler(403)
def forbidden_error(error):
    """Handle 403 errors"""
    return render_template("403.html"), 403


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return render_template("404.html"), 500


if __name__ == "__main__":
    app.run(debug=True)
