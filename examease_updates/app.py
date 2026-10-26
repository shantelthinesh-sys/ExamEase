"""ExamEase - Online Examination System (Flask application).

Roles: student, teacher, admin (stored in students.role). All permissions are
enforced here on the server with decorators - hiding buttons is never relied on.

The three DSA implementations are still used by the app:
  1. Stack  (dsa/stack.py)         - question navigation history (one per student)
  2. HashTable (dsa/hash_table.py) - finds a user by registration number at login
  3. Binary search (dsa/binary_search.py) - admin/teacher result search by reg no
"""

import os
import secrets
import hmac
from datetime import datetime, timedelta
from functools import wraps

from flask import (
    Flask, render_template, request, redirect,
    url_for, session, flash, jsonify, g, abort
)

import database as db
from dsa.stack import Stack
from dsa.hash_table import HashTable
from dsa.binary_search import binary_search

PASS_PERCENT = 40          # same pass mark the result page always used
GRACE_SECONDS = 30         # network slack allowed after the server deadline
DIFFICULTIES = ("easy", "medium", "hard")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_secret_key():
    """Secret key from env var, else a generated key kept in secret.key."""
    env = os.environ.get("EXAMEASE_SECRET_KEY")
    if env:
        return env
    path = os.path.join(BASE_DIR, "secret.key")
    try:
        if os.path.exists(path):
            with open(path) as fh:
                return fh.read().strip()
        key = secrets.token_hex(32)
        with open(path, "w") as fh:
            fh.write(key)
        return key
    except OSError:
        return secrets.token_hex(32)


app = Flask(__name__)
app.secret_key = _load_secret_key()
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# One navigation stack PER student (previously one global stack shared by everyone).
nav_stacks = {}


# --------------------------------------------------------------------------
# Auth, roles and CSRF
# --------------------------------------------------------------------------

def csrf_token():
    if "_csrf" not in session:
        session["_csrf"] = secrets.token_hex(16)
    return session["_csrf"]


@app.before_request
def load_user_and_check_csrf():
    if request.endpoint == "static":
        return None
    # Always re-read the user so a changed role / deleted account applies at once.
    g.user = None
    uid = session.get("student_id")
    if uid is not None:
        row = db.get_student_by_id(uid)
        if row is None:
            session.clear()
        else:
            g.user = {"id": row["id"], "name": row["name"],
                      "reg_no": row["reg_no"], "role": row["role"]}

    if request.method == "POST":
        sent = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token") or ""
        expected = session.get("_csrf", "")
        # An empty expected token (no session yet) must never match an empty submitted one.
        if not expected or not sent or not hmac.compare_digest(sent, expected):
            if request.is_json:
                return jsonify(ok=False, success=False, error="Session expired. Reload the page."), 400
            flash("Your session expired. Please try again.", "error")
            return redirect(request.referrer or url_for("index"))
    return None


@app.context_processor
def inject_globals():
    return {"user": g.get("user"), "csrf_token": csrf_token, "PASS_PERCENT": PASS_PERCENT}


@app.template_filter("duration")
def fmt_duration(seconds):
    if seconds is None:
        return "-"
    m, s = divmod(int(seconds), 60)
    return "%dm %02ds" % (m, s)


def home_for(role):
    return url_for({"admin": "admin_dashboard", "teacher": "teacher_dashboard"}
                   .get(role, "dashboard"))


def roles_required(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if g.user is None:
                if request.is_json:
                    return jsonify(ok=False, success=False, error="Please log in."), 401
                flash("Please log in to continue.", "error")
                return redirect(url_for("login"))
            if g.user["role"] not in roles:
                if request.is_json:
                    return jsonify(ok=False, success=False, error="Not allowed."), 403
                flash("You do not have permission to open that page.", "error")
                return redirect(home_for(g.user["role"]))
            return view(*args, **kwargs)
        return wrapped
    return decorator


login_required = roles_required("student", "teacher", "admin")
staff_required = roles_required("teacher", "admin")


@app.errorhandler(403)
@app.errorhandler(404)
def error_page(err):
    code = getattr(err, "code", 404)
    msg = "You are not allowed to access this." if code == 403 else "That page or record was not found."
    return render_template("error.html", code=code, message=msg), code


# --------------------------------------------------------------------------
# Public pages, registration, login
# --------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    """Public registration ONLY creates students. Teachers are created by an admin."""
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        reg_no = request.form.get("reg_no", "").strip()
        password = request.form.get("password", "").strip()

        if not name or not reg_no or not password:
            flash("All fields are required.", "error")
            return render_template("register.html")
        if len(password) < 4:
            flash("Password must be at least 4 characters long.", "error")
            return render_template("register.html")
        if reg_no.upper() == "ADMIN":
            flash("That registration number is reserved.", "error")
            return render_template("register.html")

        if db.add_student(name, reg_no, password):
            flash("Registration successful. Please log in.", "success")
            return redirect(url_for("login"))
        flash("That registration number is already taken.", "error")
        return render_template("register.html")

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        reg_no = request.form.get("reg_no", "").strip()
        password = request.form.get("password", "").strip()

        if not reg_no or not password:
            flash("Please enter both registration number and password.", "error")
            return render_template("login.html")

        # --- DSA: Hash Table lookup ---
        user = find_student_via_hash_table(reg_no)

        # One generic message so the page does not reveal which accounts exist.
        if user is None or not db.check_password(user["password"], password):
            flash("Invalid registration number or password.", "error")
            return render_template("login.html")

        session.clear()
        session["student_id"] = user["id"]
        return redirect(home_for(user["role"]))

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("index"))


def find_student_via_hash_table(reg_no):
    """Build a HashTable of all users and look one up by reg number (DSA demo)."""
    conn = db.get_connection()
    rows = conn.execute("SELECT * FROM students").fetchall()
    conn.close()
    table = HashTable(size=20)
    for row in rows:
        user = dict(row)
        table.insert(user["reg_no"], user)
    return table.lookup(reg_no)


# --------------------------------------------------------------------------
# Time helpers
# --------------------------------------------------------------------------

def attempt_deadline(attempt):
    return db.parse_time(attempt["deadline"])


def expire_if_needed(attempt):
    """Auto-submit an attempt whose deadline (+grace) has passed; return fresh row."""
    if attempt and attempt["status"] == "in_progress":
        if datetime.now() > attempt_deadline(attempt) + timedelta(seconds=GRACE_SECONDS):
            db.finalize_attempt(attempt["id"], "auto_submitted")
            return db.get_attempt_by_id(attempt["id"])
    return attempt


def exam_state(exam, attempt, now):
    if attempt:
        return "in_progress" if attempt["status"] == "in_progress" else "completed"
    start, end = db.parse_time(exam["start_time"]), db.parse_time(exam["end_time"])
    if start and now < start:
        return "upcoming"
    if end and now > end:
        return "closed"
    return "available"


# --------------------------------------------------------------------------
# Student: dashboard and exam taking
# --------------------------------------------------------------------------

@app.route("/dashboard")
@roles_required("student")
def dashboard():
    sid = g.user["id"]
    attempts = [expire_if_needed(a) for a in db.attempts_for_student(sid)]
    by_exam = {a["exam_id"]: a for a in attempts}
    now = datetime.now()

    groups = {"in_progress": [], "available": [], "upcoming": [], "closed": []}
    for exam in db.list_exams(status="published"):
        attempt = by_exam.get(exam["id"])
        state = exam_state(exam, attempt, now)
        if state != "completed":
            groups[state].append(exam)

    done = [a for a in attempts if a["status"] != "in_progress"]
    visible = [a for a in done if a["results_released"]]
    analytics = None
    if visible:
        pcts = [a["percentage"] for a in visible]
        analytics = {
            "count": len(visible),
            "average": round(sum(pcts) / len(pcts), 1),
            "best": max(pcts),
            "topics": [dict(t, pct=round(100 * t["correct"] / t["total"]))
                       for t in db.student_topic_performance(sid)],
        }
    return render_template("dashboard.html", groups=groups, history=done, analytics=analytics)


def get_published_exam(exam_id):
    exam = db.get_exam(exam_id)
    if exam is None or exam["status"] != "published":
        abort(404)
    return exam


@app.route("/exam/instructions")
@app.route("/exam/start")
@roles_required("student")
def legacy_exam_links():
    flash("Please choose an exam from your dashboard.", "error")
    return redirect(url_for("dashboard"))


@app.route("/exam/<int:exam_id>/instructions")
@roles_required("student")
def exam_instructions(exam_id):
    exam = get_published_exam(exam_id)
    attempt = expire_if_needed(db.get_attempt(exam_id, g.user["id"]))
    state = exam_state(exam, attempt, datetime.now())
    if state == "in_progress":
        return redirect(url_for("exam_take", exam_id=exam_id))
    if state != "available":
        flash("This exam is not open for you to start.", "error")
        return redirect(url_for("dashboard"))
    questions = db.get_exam_questions_for_student(exam_id)
    return render_template("instructions.html", exam=exam, count=len(questions),
                           total_marks=sum(q["marks"] for q in questions))


@app.route("/exam/<int:exam_id>/begin", methods=["POST"])
@roles_required("student")
def exam_begin(exam_id):
    exam = get_published_exam(exam_id)
    sid = g.user["id"]
    attempt = expire_if_needed(db.get_attempt(exam_id, sid))
    state = exam_state(exam, attempt, datetime.now())
    if state == "in_progress":
        return redirect(url_for("exam_take", exam_id=exam_id))
    if state != "available" or not db.get_exam_questions_for_student(exam_id):
        flash("This exam is not open for you to start.", "error")
        return redirect(url_for("dashboard"))

    started = datetime.now()
    deadline = started + timedelta(minutes=exam["duration_minutes"])
    db.create_attempt(exam_id, sid, started.strftime(db.TIME_FMT), deadline.strftime(db.TIME_FMT))
    return redirect(url_for("exam_take", exam_id=exam_id))


@app.route("/exam/<int:exam_id>/take")
@roles_required("student")
def exam_take(exam_id):
    exam = get_published_exam(exam_id)
    attempt = expire_if_needed(db.get_attempt(exam_id, g.user["id"]))
    if attempt is None:
        return redirect(url_for("exam_instructions", exam_id=exam_id))
    if attempt["status"] != "in_progress":
        flash("You have already submitted this exam.", "error")
        return redirect(url_for("result", attempt_id=attempt["id"]))

    remaining = int((attempt_deadline(attempt) - datetime.now()).total_seconds())
    nav_stacks[g.user["id"]] = Stack()          # fresh navigation history on (re)load
    return render_template(
        "exam.html", exam=exam,
        questions=db.get_exam_questions_for_student(exam_id),   # no correct answers
        saved=db.get_attempt_answers(attempt["id"]),
        remaining=max(remaining, 0),
    )


def store_answer(attempt, valid_ids, eq_id, selected, review):
    """Validate and save one answer. Returns True when stored."""
    try:
        eq_id = int(eq_id)
    except (TypeError, ValueError):
        return False
    if eq_id not in valid_ids:
        return False
    if selected in ("", None):
        selected = None
    elif selected not in ("a", "b", "c", "d"):
        return False
    db.save_answer(attempt["id"], eq_id, selected, bool(review))
    return True


@app.route("/exam/<int:exam_id>/save", methods=["POST"])
@roles_required("student")
def exam_save(exam_id):
    """Autosave one question's state."""
    attempt = db.get_attempt(exam_id, g.user["id"])
    if attempt is None or attempt["status"] != "in_progress":
        return jsonify(ok=False, error="This attempt is no longer active."), 409
    remaining = (attempt_deadline(attempt) - datetime.now()).total_seconds()
    if remaining < -GRACE_SECONDS:
        return jsonify(ok=False, error="Time is up."), 409

    data = request.get_json(silent=True) or {}
    valid = {q["id"] for q in db.get_exam_questions_for_student(exam_id)}
    if not store_answer(attempt, valid, data.get("question_id"),
                        data.get("selected"), data.get("review")):
        return jsonify(ok=False, error="Invalid answer."), 400
    return jsonify(ok=True, remaining=max(int(remaining), 0))


@app.route("/exam/<int:exam_id>/submit", methods=["POST"])
@roles_required("student")
def exam_submit(exam_id):
    """Final submit. Scoring is done here from stored answers, never from browser scores."""
    attempt = db.get_attempt(exam_id, g.user["id"])
    if attempt is None:
        return jsonify(success=False, error="No active attempt."), 404

    result_url = url_for("result", attempt_id=attempt["id"])
    if attempt["status"] != "in_progress":      # duplicate submit -> same result, no new row
        return jsonify(success=True, redirect=result_url, duplicate=True)

    data = request.get_json(silent=True) or {}
    in_time = datetime.now() <= attempt_deadline(attempt) + timedelta(seconds=GRACE_SECONDS)
    if in_time:     # late payloads are ignored; only answers autosaved in time count
        valid = {q["id"] for q in db.get_exam_questions_for_student(exam_id)}
        review = {str(x) for x in (data.get("review") or [])}
        answers = data.get("answers") or {}
        if isinstance(answers, dict):
            for eq_id, selected in answers.items():
                store_answer(attempt, valid, eq_id, selected, str(eq_id) in review)

    status = "auto_submitted" if (data.get("auto") or not in_time) else "submitted"
    db.finalize_attempt(attempt["id"], status)
    return jsonify(success=True, redirect=result_url)


@app.route("/exam/previous")
@roles_required("student")
def exam_previous():
    """Pop the last visited question index (Stack demo)."""
    return jsonify(previous_index=nav_stacks.setdefault(g.user["id"], Stack()).pop())


@app.route("/exam/visit", methods=["POST"])
@roles_required("student")
def exam_visit():
    """Push a visited question index onto this student's stack."""
    stack = nav_stacks.setdefault(g.user["id"], Stack())
    index = (request.get_json(silent=True) or {}).get("index")
    if isinstance(index, int):
        stack.push(index)
    return jsonify(ok=True, stack_size=stack.size())


# --------------------------------------------------------------------------
# Results (student / teacher / admin)
# --------------------------------------------------------------------------

def build_review(attempt):
    answers = db.get_attempt_answers(attempt["id"])
    rows = []
    for i, q in enumerate(db.get_exam_questions_full(attempt["exam_id"]), start=1):
        saved = answers.get(q["id"]) or {}
        sel = saved.get("selected")
        status = "unanswered" if not sel else ("correct" if sel == q["correct_option"] else "wrong")
        rows.append({"number": i, "q": q, "selected": sel, "status": status,
                     "review": saved.get("review", False)})
    return rows


@app.route("/result/<int:attempt_id>")
@login_required
def result(attempt_id):
    attempt = expire_if_needed(db.get_attempt_by_id(attempt_id))
    exam = db.get_exam(attempt["exam_id"]) if attempt else None
    if attempt is None or exam is None:
        flash("Result not found.", "error")
        return redirect(home_for(g.user["role"]))

    role, uid = g.user["role"], g.user["id"]
    allowed = (role == "admin"
               or (role == "teacher" and exam["created_by"] == uid)
               or (role == "student" and attempt["student_id"] == uid))
    if not allowed:
        flash("You can only view results you are authorised to see.", "error")
        return redirect(home_for(role))
    if attempt["status"] == "in_progress":
        return redirect(url_for("exam_take", exam_id=exam["id"]))

    student = db.get_student_by_id(attempt["student_id"])
    pending = role == "student" and not exam["results_released"]
    review, topics = [], []
    if not pending:
        review = build_review(attempt)
        agg = {}
        for r in review:
            t = r["q"]["topic"] or "General"
            agg.setdefault(t, [0, 0])
            agg[t][1] += 1
            agg[t][0] += 1 if r["status"] == "correct" else 0
        topics = [{"topic": t, "correct": c, "total": n, "pct": round(100 * c / n)}
                  for t, (c, n) in sorted(agg.items())]
    return render_template("result.html", attempt=attempt, exam=exam, student=student,
                           pending=pending, review=review, topics=topics)


# --------------------------------------------------------------------------
# Search results (Binary Search demonstration) - teacher and admin
# --------------------------------------------------------------------------

@app.route("/search", methods=["GET", "POST"])
@staff_required
def search():
    matches, searched, query_reg = [], False, ""
    if request.method == "POST":
        query_reg = request.form.get("reg_no", "").strip()
        owner = None if g.user["role"] == "admin" else g.user["id"]
        ordered = db.all_attempts(owner)
        ordered.sort(key=lambda r: r["reg_no"])      # binary search needs sorted input
        found = binary_search(ordered, query_reg)
        if found is not None:                        # collect all rows with that reg no
            i = ordered.index(found)
            lo = hi = i
            while lo > 0 and ordered[lo - 1]["reg_no"] == query_reg:
                lo -= 1
            while hi < len(ordered) - 1 and ordered[hi + 1]["reg_no"] == query_reg:
                hi += 1
            matches = ordered[lo:hi + 1]
        searched = True
    return render_template("search.html", matches=matches, searched=searched, query_reg=query_reg)


# --------------------------------------------------------------------------
# Question bank (teacher: own + shared read-only; admin: everything)
# --------------------------------------------------------------------------

def can_edit_question(q):
    return g.user["role"] == "admin" or q["owner_id"] == g.user["id"]


def read_question_form(form):
    f = {k: form.get(k, "").strip() for k in (
        "question", "option_a", "option_b", "option_c", "option_d",
        "correct_option", "subject", "topic", "difficulty", "explanation")}
    try:
        f["marks"] = int(form.get("marks", "1"))
    except ValueError:
        f["marks"] = 0
    errors = []
    opts = [f["option_a"], f["option_b"], f["option_c"], f["option_d"]]
    if not f["question"] or not all(opts):
        errors.append("The question and all four options are required.")
    if len(f["question"]) > 2000 or any(len(o) > 500 for o in opts):
        errors.append("Question (max 2000 characters) or an option (max 500) is too long.")
    if len({o.lower() for o in opts}) < 4 and all(opts):
        errors.append("The four options must be different from each other.")
    if f["correct_option"] not in ("a", "b", "c", "d"):
        errors.append("Choose which option is correct.")
    if f["difficulty"] not in DIFFICULTIES:
        errors.append("Difficulty must be easy, medium or hard.")
    if not 1 <= f["marks"] <= 100:
        errors.append("Marks must be a whole number from 1 to 100.")
    if len(f["subject"]) > 100 or len(f["topic"]) > 100 or len(f["explanation"]) > 2000:
        errors.append("Subject/topic (max 100) or explanation (max 2000) is too long.")
    return f, errors


@app.route("/questions")
@staff_required
def question_list():
    owner = None if g.user["role"] == "admin" else g.user["id"]
    flt = {k: request.args.get(k, "").strip() for k in ("search", "subject", "topic", "difficulty")}
    return render_template(
        "question_list.html", flt=flt,
        questions=db.list_questions(owner, **flt),
        subjects=db.distinct_values("subject", owner),
        topics=db.distinct_values("topic", owner),
        difficulties=DIFFICULTIES)


@app.route("/questions/add", methods=["GET", "POST"])
@app.route("/admin/questions/add", methods=["GET", "POST"])
@staff_required
def question_add():
    form = {"marks": 1, "difficulty": "medium"}
    if request.method == "POST":
        form, errors = read_question_form(request.form)
        if not errors:
            db.create_question(g.user["id"], form)
            flash("Question added.", "success")
            return redirect(url_for("question_list"))
        for e in errors:
            flash(e, "error")
    return render_template("admin_question_form.html", mode="add", q=form, difficulties=DIFFICULTIES)


@app.route("/questions/<int:question_id>/edit", methods=["GET", "POST"])
@app.route("/admin/questions/edit/<int:question_id>", methods=["GET", "POST"])
@staff_required
def question_edit(question_id):
    question = db.get_question(question_id)
    if question is None:
        abort(404)
    if not can_edit_question(question):
        flash("You can only edit questions you created.", "error")
        return redirect(url_for("question_list"))
    form = question
    if request.method == "POST":
        form, errors = read_question_form(request.form)
        form["id"] = question_id
        if not errors:
            db.update_question_full(question_id, form)
            flash("Question updated. Exams already built from it keep their original wording.", "success")
            return redirect(url_for("question_list"))
        for e in errors:
            flash(e, "error")
    return render_template("admin_question_form.html", mode="edit", q=form, difficulties=DIFFICULTIES)


@app.route("/questions/<int:question_id>/delete", methods=["POST"])
@app.route("/admin/questions/delete/<int:question_id>", methods=["POST"])
@staff_required
def question_delete(question_id):
    question = db.get_question(question_id)
    if question is None:
        abort(404)
    if not can_edit_question(question):
        flash("You can only delete questions you created.", "error")
    else:
        db.delete_question(question_id)     # exam snapshots are unaffected
        flash("Question deleted. Existing exams and results are unchanged.", "success")
    return redirect(url_for("question_list"))


# --------------------------------------------------------------------------
# Exam management (teacher: own exams; admin: all exams)
# --------------------------------------------------------------------------

def load_exam_for_manage(exam_id):
    exam = db.get_exam(exam_id)
    if exam is None:
        abort(404)
    if g.user["role"] != "admin" and exam["created_by"] != g.user["id"]:
        abort(403)
    return exam


def read_exam_form(form):
    f = {k: form.get(k, "").strip() for k in ("title", "description", "instructions", "subject")}
    f["results_released"] = 1 if form.get("results_released") else 0
    errors = []
    try:
        f["duration_minutes"] = int(form.get("duration_minutes", ""))
    except ValueError:
        f["duration_minutes"] = 0
    if not 3 <= len(f["title"]) <= 150:
        errors.append("Title must be 3 to 150 characters.")
    if not 1 <= f["duration_minutes"] <= 300:
        errors.append("Duration must be 1 to 300 minutes.")
    if len(f["description"]) > 1000 or len(f["instructions"]) > 3000 or len(f["subject"]) > 100:
        errors.append("Description (1000), instructions (3000) or subject (100) is too long.")

    parsed = {}
    for key in ("start_time", "end_time"):
        raw = form.get(key, "").strip()
        parsed[key] = None
        if raw:
            try:
                parsed[key] = datetime.strptime(raw, "%Y-%m-%dT%H:%M")
            except ValueError:
                errors.append("Invalid date/time for %s." % key.replace("_", " "))
    if parsed["start_time"] and parsed["end_time"] and parsed["end_time"] <= parsed["start_time"]:
        errors.append("The end time must be after the start time.")
    # Keep the typed values (datetime-local format) so the form can be re-shown.
    f["start_time"] = parsed["start_time"].strftime(db.TIME_FMT) if parsed["start_time"] else None
    f["end_time"] = parsed["end_time"].strftime(db.TIME_FMT) if parsed["end_time"] else None
    return f, errors


def publish_problems(exam, questions):
    problems = []
    if not questions:
        problems.append("Add at least one question.")
    if any(q["marks"] < 1 for q in questions):
        problems.append("Every question needs marks of at least 1.")
    if not 1 <= exam["duration_minutes"] <= 300:
        problems.append("Set a duration between 1 and 300 minutes.")
    end, start = db.parse_time(exam["end_time"]), db.parse_time(exam["start_time"])
    if end and end <= datetime.now():
        problems.append("The end time is already in the past.")
    if start and end and end <= start:
        problems.append("The end time must be after the start time.")
    return problems


@app.route("/teacher")
@roles_required("teacher")
def teacher_dashboard():
    uid = g.user["id"]
    exams = db.list_exams(owner_id=uid)
    return render_template(
        "teacher_dashboard.html", exams=exams,
        my_questions=len([q for q in db.list_questions(uid) if q["owner_id"] == uid]),
        attempts=sum(e["attempt_count"] for e in exams))


@app.route("/exams/new", methods=["GET", "POST"])
@staff_required
def exam_new():
    form = {"duration_minutes": 30, "results_released": 1}
    if request.method == "POST":
        form, errors = read_exam_form(request.form)
        if not errors:
            exam_id = db.create_exam(g.user["id"], form)
            flash("Draft saved. Now add questions.", "success")
            return redirect(url_for("exam_manage", exam_id=exam_id))
        for e in errors:
            flash(e, "error")
        form = dict(request.form, results_released=1 if request.form.get("results_released") else 0)
    return render_template("exam_form.html", mode="new", e=form)


@app.route("/exams/<int:exam_id>/edit", methods=["GET", "POST"])
@staff_required
def exam_edit(exam_id):
    exam = load_exam_for_manage(exam_id)
    if exam["status"] != "draft":
        flash("Published exams cannot be edited. Unpublish it (only possible before any attempt) "
              "or duplicate it as a new draft.", "error")
        return redirect(url_for("exam_manage", exam_id=exam_id))
    form = dict(exam, start_time=(exam["start_time"] or "")[:16].replace(" ", "T"),
                end_time=(exam["end_time"] or "")[:16].replace(" ", "T"))
    if request.method == "POST":
        parsed, errors = read_exam_form(request.form)
        if not errors:
            db.update_exam(exam_id, parsed)
            flash("Exam details saved.", "success")
            return redirect(url_for("exam_manage", exam_id=exam_id))
        for e in errors:
            flash(e, "error")
        form = dict(request.form, results_released=1 if request.form.get("results_released") else 0)
    return render_template("exam_form.html", mode="edit", e=form, exam=exam)


@app.route("/exams/<int:exam_id>")
@staff_required
def exam_manage(exam_id):
    exam = load_exam_for_manage(exam_id)
    owner = None if g.user["role"] == "admin" else g.user["id"]
    flt = {k: request.args.get(k, "").strip() for k in ("search", "subject", "topic", "difficulty")}
    eqs = db.get_exam_questions_full(exam_id)
    used = {q["source_question_id"] for q in eqs}
    bank = [q for q in db.list_questions(owner, **flt) if q["id"] not in used] \
        if exam["status"] == "draft" else []
    attempts = len(db.attempts_for_exam(exam_id))
    return render_template(
        "exam_manage.html", exam=exam, eqs=eqs, bank=bank, flt=flt, attempts=attempts,
        total_marks=sum(q["marks"] for q in eqs),
        subjects=db.distinct_values("subject", owner), topics=db.distinct_values("topic", owner),
        difficulties=DIFFICULTIES)


@app.route("/exams/<int:exam_id>/questions/add", methods=["POST"])
@staff_required
def exam_add_questions(exam_id):
    exam = load_exam_for_manage(exam_id)
    if exam["status"] != "draft":
        flash("Questions can only be changed while the exam is a draft.", "error")
        return redirect(url_for("exam_manage", exam_id=exam_id))
    ids = [int(x) for x in request.form.getlist("question_ids") if x.isdigit()]
    owner = None if g.user["role"] == "admin" else g.user["id"]
    added = db.add_questions_to_exam(exam_id, ids, owner)
    flash("%d question(s) added." % added if added else "No questions were added.",
          "success" if added else "error")
    return redirect(url_for("exam_manage", exam_id=exam_id))


@app.route("/exams/<int:exam_id>/marks", methods=["POST"])
@staff_required
def exam_set_marks(exam_id):
    exam = load_exam_for_manage(exam_id)
    if exam["status"] != "draft":
        flash("Marks can only be changed while the exam is a draft.", "error")
        return redirect(url_for("exam_manage", exam_id=exam_id))
    marks = {}
    for q in db.get_exam_questions_full(exam_id):
        raw = request.form.get("marks_%d" % q["id"], "")
        if not raw.isdigit() or not 1 <= int(raw) <= 100:
            flash("Marks must be whole numbers from 1 to 100.", "error")
            return redirect(url_for("exam_manage", exam_id=exam_id))
        marks[q["id"]] = int(raw)
    db.update_exam_question_marks(exam_id, marks)
    flash("Marks saved.", "success")
    return redirect(url_for("exam_manage", exam_id=exam_id))


@app.route("/exams/<int:exam_id>/questions/<int:eq_id>/remove", methods=["POST"])
@staff_required
def exam_remove_question(exam_id, eq_id):
    exam = load_exam_for_manage(exam_id)
    if exam["status"] != "draft":
        flash("Questions can only be changed while the exam is a draft.", "error")
    else:
        db.remove_exam_question(exam_id, eq_id)
        flash("Question removed from the exam.", "success")
    return redirect(url_for("exam_manage", exam_id=exam_id))


@app.route("/exams/<int:exam_id>/publish", methods=["POST"])
@staff_required
def exam_publish(exam_id):
    exam = load_exam_for_manage(exam_id)
    if exam["status"] == "draft":
        problems = publish_problems(exam, db.get_exam_questions_full(exam_id))
        if problems:
            for p in problems:
                flash("Cannot publish: " + p, "error")
        else:
            db.set_exam_status(exam_id, "published")
            flash("Exam published. Students can now see it.", "success")
    return redirect(url_for("exam_manage", exam_id=exam_id))


@app.route("/exams/<int:exam_id>/unpublish", methods=["POST"])
@staff_required
def exam_unpublish(exam_id):
    exam = load_exam_for_manage(exam_id)
    if db.attempts_for_exam(exam_id):
        flash("This exam already has attempts, so it cannot be unpublished. "
              "Use Duplicate to make a new version.", "error")
    elif exam["status"] == "published":
        db.set_exam_status(exam_id, "draft")
        flash("Exam moved back to draft.", "success")
    return redirect(url_for("exam_manage", exam_id=exam_id))


@app.route("/exams/<int:exam_id>/release", methods=["POST"])
@staff_required
def exam_release(exam_id):
    load_exam_for_manage(exam_id)
    release = request.form.get("release") == "1"
    db.set_results_released(exam_id, release)
    flash("Results are now visible to students." if release else "Results are now hidden from students.",
          "success")
    return redirect(request.referrer or url_for("exam_manage", exam_id=exam_id))


@app.route("/exams/<int:exam_id>/duplicate", methods=["POST"])
@staff_required
def exam_duplicate(exam_id):
    load_exam_for_manage(exam_id)
    new_id = db.duplicate_exam(exam_id, g.user["id"])
    flash("Created a new draft copy.", "success")
    return redirect(url_for("exam_manage", exam_id=new_id))


@app.route("/exams/<int:exam_id>/delete", methods=["POST"])
@staff_required
def exam_delete(exam_id):
    exam = load_exam_for_manage(exam_id)
    if exam["status"] != "draft" or db.attempts_for_exam(exam_id):
        flash("Only drafts without attempts can be deleted.", "error")
        return redirect(url_for("exam_manage", exam_id=exam_id))
    db.delete_exam(exam_id)
    flash("Draft deleted.", "success")
    return redirect(home_for(g.user["role"]))


@app.route("/exams/<int:exam_id>/preview")
@staff_required
def exam_preview(exam_id):
    exam = load_exam_for_manage(exam_id)
    return render_template("exam_preview.html", exam=exam,
                           questions=db.get_exam_questions_for_student(exam_id))


@app.route("/exams/<int:exam_id>/results")
@staff_required
def exam_results(exam_id):
    exam = load_exam_for_manage(exam_id)
    attempts = [expire_if_needed(a) for a in db.attempts_for_exam(exam_id)]
    return render_template("exam_results.html", exam=exam, attempts=attempts,
                           stats=db.exam_stats(exam_id, PASS_PERCENT),
                           qstats=db.question_stats(exam_id))


# --------------------------------------------------------------------------
# Admin
# --------------------------------------------------------------------------

@app.route("/admin")
@roles_required("admin")
def admin_dashboard():
    return render_template("admin_dashboard.html", stats=db.platform_stats(),
                           exams=db.list_exams())


@app.route("/admin/users", methods=["GET", "POST"])
@roles_required("admin")
def admin_users():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        reg_no = request.form.get("reg_no", "").strip()
        password = request.form.get("password", "")
        role = request.form.get("role", "teacher")
        if not name or not reg_no or len(password) < 6 or role not in ("teacher", "student"):
            flash("Name, ID, a role and a password of at least 6 characters are required.", "error")
        elif reg_no.upper() == "ADMIN":
            flash("That ID is reserved.", "error")
        elif db.add_student(name, reg_no, password, role=role):
            flash("%s account created for %s." % (role.capitalize(), name), "success")
        else:
            flash("That ID is already in use.", "error")
        return redirect(url_for("admin_users"))
    return render_template("admin_users.html", users=db.list_users())


@app.route("/admin/users/<int:target_id>/role", methods=["POST"])
@roles_required("admin")
def admin_set_role(target_id):
    target = db.get_student_by_id(target_id)
    role = request.form.get("role")
    if target is None or role not in ("student", "teacher"):
        flash("Invalid request.", "error")
    elif target["role"] == "admin" or target["id"] == g.user["id"]:
        flash("The administrator account's role cannot be changed here.", "error")
    else:
        db.set_user_role(target_id, role)
        flash("Role updated for %s." % target["name"], "success")
    return redirect(url_for("admin_users"))


# --------------------------------------------------------------------------
# Start the app
# --------------------------------------------------------------------------

def setup_database():
    db.init_db()
    db.seed_questions_if_empty()
    db.seed_admin_if_missing()
    db.seed_default_exam_if_missing()


if __name__ == "__main__":
    setup_database()
    app.run(debug=True)
