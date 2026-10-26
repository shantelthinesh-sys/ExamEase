"""SQLite database helper for the ExamEase project.

This file creates the database tables and provides simple helper functions
for students, questions, and results. The database file is exam.db and is
created automatically the first time the app runs.

Tables:
  students  - registered students (password stored as a hash, never plain text)
  questions - MCQ questions added by the admin
  results   - exam attempts stored after a student submits
"""

import sqlite3
import os
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exam.db")


def get_connection():
    """Open a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    # Return rows as dictionaries so we can use column names.
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create all tables if they do not already exist."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            reg_no TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_option TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            reg_no TEXT NOT NULL,
            name TEXT NOT NULL,
            marks INTEGER NOT NULL,
            total INTEGER NOT NULL,
            percentage REAL NOT NULL,
            submitted_at TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students(id)
        )
        """
    )

    conn.commit()
    conn.close()

    # Backward-compatible upgrades (adds roles, exams, attempts).
    migrate_db()


# ----- Student helpers -----

def add_student(name, reg_no, password, role="student"):
    """Insert a new user. Password is hashed before storing.

    role is 'student' (default), 'teacher' or 'admin'. Public registration
    always uses the default; only admin code paths pass another role.
    """
    conn = get_connection()
    cur = conn.cursor()
    hashed = generate_password_hash(password)
    try:
        cur.execute(
            "INSERT INTO students (name, reg_no, password, role) VALUES (?, ?, ?, ?)",
            (name, reg_no, hashed, role),
        )
        conn.commit()
        success = True
    except sqlite3.IntegrityError:
        # reg_no is UNIQUE, so a duplicate registration fails here.
        success = False
    conn.close()
    return success


def get_student_by_reg_no(reg_no):
    """Return a student row dict by registration number, or None."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM students WHERE reg_no = ?", (reg_no,))
    row = cur.fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)


def get_student_by_id(student_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM students WHERE id = ?", (student_id,))
    row = cur.fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)


def check_password(stored_hash, plain_password):
    """Compare a plain password against the stored hash."""
    return check_password_hash(stored_hash, plain_password)


# ----- Question helpers -----

def add_question(question, a, b, c, d, correct):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO questions
           (question, option_a, option_b, option_c, option_d, correct_option)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (question, a, b, c, d, correct),
    )
    conn.commit()
    conn.close()


def get_all_questions():
    """Return all questions (used by admin only)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM questions ORDER BY id")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_exam_questions():
    """Return all questions WITHOUT the correct answer (for students).

    The correct_option column is removed so it can never reach the browser.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, question, option_a, option_b, option_c, option_d FROM questions ORDER BY id"
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_question(question_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM questions WHERE id = ?", (question_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def update_question(question_id, question, a, b, c, d, correct):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """UPDATE questions SET
           question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?
           WHERE id = ?""",
        (question, a, b, c, d, correct, question_id),
    )
    conn.commit()
    conn.close()


def delete_question(question_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM questions WHERE id = ?", (question_id,))
    conn.commit()
    conn.close()


# ----- Result helpers -----

def save_result(student_id, reg_no, name, marks, total, percentage):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO results
           (student_id, reg_no, name, marks, total, percentage, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))""",
        (student_id, reg_no, name, marks, total, percentage),
    )
    conn.commit()
    conn.close()


def get_results_for_student(student_id):
    """Return all past results for one student, newest first."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM results WHERE student_id = ? ORDER BY id DESC",
        (student_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_results():
    """Return every result in the database (admin view)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM results ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def has_already_attempted(student_id):
    """A student may only attempt the exam once."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM results WHERE student_id = ?", (student_id,))
    row = cur.fetchone()
    conn.close()
    return row["c"] > 0


# ----- Sample data -----

def seed_questions_if_empty():
    """Add a few sample MCQs when the questions table is empty."""
    if len(get_all_questions()) > 0:
        return
    samples = [
        (
            "Which data structure works on the LIFO principle?",
            "Queue", "Stack", "Array", "Linked List", "b",
        ),
        (
            "What is the time complexity of binary search on a sorted array?",
            "O(n)", "O(n^2)", "O(log n)", "O(1)", "c",
        ),
        (
            "Which operator is used to compare two values in Python?",
            "=", "==", "===", "!=", "b",
        ),
        (
            "Which keyword is used to define a function in Python?",
            "func", "define", "def", "function", "c",
        ),
        (
            "A hash table is mainly used for which operation?",
            "Sorting", "Fast lookup", "Graph traversal", "Recursion", "b",
        ),
        (
            "Which of these is NOT a linear data structure?",
            "Array", "Queue", "Stack", "Tree", "d",
        ),
    ]
    for q in samples:
        add_question(q[0], q[1], q[2], q[3], q[4], q[5])


def seed_admin_if_missing():
    """Create a default admin user so the admin area can be used.

    The admin is stored in the students table with a special reg_no 'ADMIN'.
    We treat any student whose reg_no is 'ADMIN' as the admin.
    Username: ADMIN  Password: admin123
    """
    if get_student_by_reg_no("ADMIN") is None:
        add_student("Administrator", "ADMIN", "admin123", role="admin")


# ==========================================================================
# Teacher / exam extension (backward compatible: only ADDS columns & tables)
# ==========================================================================

TIME_FMT = "%Y-%m-%d %H:%M:%S"


def now_str():
    return datetime.now().strftime(TIME_FMT)


def parse_time(value):
    """Parse a stored timestamp. Returns None for empty/invalid values."""
    if not value:
        return None
    try:
        return datetime.strptime(value, TIME_FMT)
    except ValueError:
        return None


def _column_names(conn, table):
    return [r["name"] for r in conn.execute("PRAGMA table_info(%s)" % table)]


def migrate_db():
    """Add the role column, question metadata and the exam tables.

    Safe to run on every start: existing rows and tables are never dropped.
    """
    conn = get_connection()
    cur = conn.cursor()

    if "role" not in _column_names(conn, "students"):
        cur.execute("ALTER TABLE students ADD COLUMN role TEXT NOT NULL DEFAULT 'student'")
    cur.execute("UPDATE students SET role = 'admin' WHERE reg_no = 'ADMIN'")

    q_cols = _column_names(conn, "questions")
    for name, ddl in (
        ("subject", "TEXT NOT NULL DEFAULT ''"),
        ("topic", "TEXT NOT NULL DEFAULT ''"),
        ("difficulty", "TEXT NOT NULL DEFAULT 'medium'"),
        ("marks", "INTEGER NOT NULL DEFAULT 1"),
        ("explanation", "TEXT NOT NULL DEFAULT ''"),
        ("owner_id", "INTEGER"),  # NULL = shared/legacy question
    ):
        if name not in q_cols:
            cur.execute("ALTER TABLE questions ADD COLUMN %s %s" % (name, ddl))

    cur.execute(
        """CREATE TABLE IF NOT EXISTS exams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            instructions TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            duration_minutes INTEGER NOT NULL DEFAULT 30,
            start_time TEXT,
            end_time TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            results_released INTEGER NOT NULL DEFAULT 0,
            created_by INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            published_at TEXT
        )"""
    )
    # Snapshot of each question AS USED in an exam. Later edits/deletes in the
    # question bank never change this record, so old attempts stay intact.
    cur.execute(
        """CREATE TABLE IF NOT EXISTS exam_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id INTEGER NOT NULL,
            source_question_id INTEGER,
            position INTEGER NOT NULL DEFAULT 0,
            question TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_option TEXT NOT NULL,
            marks INTEGER NOT NULL DEFAULT 1,
            topic TEXT NOT NULL DEFAULT '',
            difficulty TEXT NOT NULL DEFAULT 'medium',
            explanation TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (exam_id) REFERENCES exams(id)
        )"""
    )
    cur.execute(
        """CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            started_at TEXT NOT NULL,
            deadline TEXT NOT NULL,
            submitted_at TEXT,
            status TEXT NOT NULL DEFAULT 'in_progress',
            marks INTEGER,
            total_marks INTEGER,
            percentage REAL,
            correct_count INTEGER,
            wrong_count INTEGER,
            unanswered_count INTEGER,
            time_taken_seconds INTEGER,
            UNIQUE (exam_id, student_id),
            FOREIGN KEY (exam_id) REFERENCES exams(id),
            FOREIGN KEY (student_id) REFERENCES students(id)
        )"""
    )
    cur.execute(
        """CREATE TABLE IF NOT EXISTS attempt_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            attempt_id INTEGER NOT NULL,
            exam_question_id INTEGER NOT NULL,
            selected TEXT,
            marked_review INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT,
            UNIQUE (attempt_id, exam_question_id),
            FOREIGN KEY (attempt_id) REFERENCES attempts(id)
        )"""
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_eq_exam ON exam_questions(exam_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_att_student ON attempts(student_id)")
    conn.commit()
    conn.close()


# ----- tiny query helpers -----

def _all(sql, params=()):
    conn = get_connection()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _one(sql, params=()):
    rows = _all(sql, params)
    return rows[0] if rows else None


def _run(sql, params=()):
    conn = get_connection()
    cur = conn.execute(sql, params)
    conn.commit()
    result = (cur.lastrowid, cur.rowcount)
    conn.close()
    return result


# ----- Users (admin) -----

def list_users():
    return _all("SELECT id, name, reg_no, role FROM students ORDER BY role, reg_no")


def set_user_role(user_id, role):
    _run("UPDATE students SET role = ? WHERE id = ?", (role, user_id))


def platform_stats():
    roles = {r["role"]: r["c"] for r in _all(
        "SELECT role, COUNT(*) AS c FROM students GROUP BY role")}
    exams = {r["status"]: r["c"] for r in _all(
        "SELECT status, COUNT(*) AS c FROM exams GROUP BY status")}
    att = _one("""SELECT COUNT(*) AS submitted, AVG(percentage) AS avg_pct
                  FROM attempts WHERE status != 'in_progress'""")
    return {
        "students": roles.get("student", 0),
        "teachers": roles.get("teacher", 0),
        "exams_published": exams.get("published", 0),
        "exams_draft": exams.get("draft", 0),
        "attempts": att["submitted"],
        "avg_pct": round(att["avg_pct"], 1) if att["avg_pct"] is not None else None,
        "questions": _one("SELECT COUNT(*) AS c FROM questions")["c"],
    }


# ----- Question bank (teacher/admin) -----

def list_questions(owner_id=None, search="", subject="", topic="", difficulty=""):
    """owner_id=None -> everything (admin). Otherwise own + shared questions."""
    sql = "SELECT * FROM questions WHERE 1=1"
    params = []
    if owner_id is not None:
        sql += " AND (owner_id = ? OR owner_id IS NULL)"
        params.append(owner_id)
    if search:
        sql += " AND (question LIKE ? OR topic LIKE ?)"
        params += ["%" + search + "%"] * 2
    if subject:
        sql += " AND subject = ?"
        params.append(subject)
    if topic:
        sql += " AND topic = ?"
        params.append(topic)
    if difficulty:
        sql += " AND difficulty = ?"
        params.append(difficulty)
    return _all(sql + " ORDER BY id", params)


def distinct_values(column, owner_id=None):
    assert column in ("subject", "topic")
    sql = "SELECT DISTINCT %s AS v FROM questions WHERE %s != ''" % (column, column)
    params = []
    if owner_id is not None:
        sql += " AND (owner_id = ? OR owner_id IS NULL)"
        params.append(owner_id)
    return [r["v"] for r in _all(sql + " ORDER BY v", params)]


def create_question(owner_id, f):
    return _run(
        """INSERT INTO questions (question, option_a, option_b, option_c, option_d,
               correct_option, subject, topic, difficulty, marks, explanation, owner_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (f["question"], f["option_a"], f["option_b"], f["option_c"], f["option_d"],
         f["correct_option"], f["subject"], f["topic"], f["difficulty"],
         f["marks"], f["explanation"], owner_id),
    )[0]


def update_question_full(question_id, f):
    _run(
        """UPDATE questions SET question=?, option_a=?, option_b=?, option_c=?, option_d=?,
               correct_option=?, subject=?, topic=?, difficulty=?, marks=?, explanation=?
           WHERE id=?""",
        (f["question"], f["option_a"], f["option_b"], f["option_c"], f["option_d"],
         f["correct_option"], f["subject"], f["topic"], f["difficulty"],
         f["marks"], f["explanation"], question_id),
    )


# ----- Exams -----

def create_exam(owner_id, f):
    return _run(
        """INSERT INTO exams (title, description, instructions, subject, duration_minutes,
               start_time, end_time, results_released, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (f["title"], f["description"], f["instructions"], f["subject"],
         f["duration_minutes"], f["start_time"], f["end_time"],
         f["results_released"], owner_id, now_str()),
    )[0]


def update_exam(exam_id, f):
    _run(
        """UPDATE exams SET title=?, description=?, instructions=?, subject=?,
               duration_minutes=?, start_time=?, end_time=?, results_released=?
           WHERE id=?""",
        (f["title"], f["description"], f["instructions"], f["subject"],
         f["duration_minutes"], f["start_time"], f["end_time"],
         f["results_released"], exam_id),
    )


def get_exam(exam_id):
    return _one("SELECT * FROM exams WHERE id = ?", (exam_id,))


def list_exams(owner_id=None, status=None):
    sql = """SELECT e.*,
        (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count,
        (SELECT COALESCE(SUM(marks), 0) FROM exam_questions q WHERE q.exam_id = e.id) AS total_marks,
        (SELECT COUNT(*) FROM attempts a WHERE a.exam_id = e.id) AS attempt_count,
        (SELECT name FROM students s WHERE s.id = e.created_by) AS owner_name
        FROM exams e WHERE 1=1"""
    params = []
    if owner_id is not None:
        sql += " AND e.created_by = ?"
        params.append(owner_id)
    if status:
        sql += " AND e.status = ?"
        params.append(status)
    return _all(sql + " ORDER BY e.id DESC", params)


def set_exam_status(exam_id, status):
    published_at = now_str() if status == "published" else None
    _run("UPDATE exams SET status = ?, published_at = ? WHERE id = ?",
         (status, published_at, exam_id))


def set_results_released(exam_id, released):
    _run("UPDATE exams SET results_released = ? WHERE id = ?", (1 if released else 0, exam_id))


def delete_exam(exam_id):
    conn = get_connection()
    conn.execute("DELETE FROM exam_questions WHERE exam_id = ?", (exam_id,))
    conn.execute("DELETE FROM exams WHERE id = ?", (exam_id,))
    conn.commit()
    conn.close()


def get_exam_questions_full(exam_id):
    """Snapshot rows INCLUDING answers (teacher/admin/grading only)."""
    return _all("SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY position, id", (exam_id,))


def get_exam_questions_for_student(exam_id):
    """Snapshot rows WITHOUT correct_option/explanation (safe for the browser)."""
    return _all(
        """SELECT id, question, option_a, option_b, option_c, option_d, marks
           FROM exam_questions WHERE exam_id = ? ORDER BY position, id""",
        (exam_id,),
    )


def add_questions_to_exam(exam_id, question_ids, owner_id=None):
    """Copy bank questions into the exam as snapshots. Returns how many were added.

    owner_id (teachers) restricts to their own + shared questions.
    """
    conn = get_connection()
    existing = {r["source_question_id"] for r in conn.execute(
        "SELECT source_question_id FROM exam_questions WHERE exam_id = ?", (exam_id,))}
    pos = conn.execute(
        "SELECT COALESCE(MAX(position), 0) AS m FROM exam_questions WHERE exam_id = ?",
        (exam_id,)).fetchone()["m"]
    added = 0
    for qid in question_ids:
        if qid in existing:
            continue
        sql = "SELECT * FROM questions WHERE id = ?"
        params = [qid]
        if owner_id is not None:
            sql += " AND (owner_id = ? OR owner_id IS NULL)"
            params.append(owner_id)
        q = conn.execute(sql, params).fetchone()
        if q is None:
            continue
        pos += 1
        conn.execute(
            """INSERT INTO exam_questions (exam_id, source_question_id, position, question,
                   option_a, option_b, option_c, option_d, correct_option, marks, topic,
                   difficulty, explanation)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (exam_id, q["id"], pos, q["question"], q["option_a"], q["option_b"],
             q["option_c"], q["option_d"], q["correct_option"], q["marks"],
             q["topic"], q["difficulty"], q["explanation"]),
        )
        added += 1
    conn.commit()
    conn.close()
    return added


def remove_exam_question(exam_id, exam_question_id):
    _run("DELETE FROM exam_questions WHERE id = ? AND exam_id = ?", (exam_question_id, exam_id))


def update_exam_question_marks(exam_id, marks_by_id):
    conn = get_connection()
    for eq_id, marks in marks_by_id.items():
        conn.execute("UPDATE exam_questions SET marks = ? WHERE id = ? AND exam_id = ?",
                     (marks, eq_id, exam_id))
    conn.commit()
    conn.close()


def duplicate_exam(exam_id, owner_id):
    """Create a new DRAFT copy (new version) including question snapshots."""
    src = get_exam(exam_id)
    new_id = _run(
        """INSERT INTO exams (title, description, instructions, subject, duration_minutes,
               start_time, end_time, results_released, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)""",
        (src["title"] + " (copy)", src["description"], src["instructions"], src["subject"],
         src["duration_minutes"], src["results_released"], owner_id, now_str()),
    )[0]
    conn = get_connection()
    conn.execute(
        """INSERT INTO exam_questions (exam_id, source_question_id, position, question,
               option_a, option_b, option_c, option_d, correct_option, marks, topic,
               difficulty, explanation)
           SELECT ?, source_question_id, position, question, option_a, option_b, option_c,
               option_d, correct_option, marks, topic, difficulty, explanation
           FROM exam_questions WHERE exam_id = ?""",
        (new_id, exam_id),
    )
    conn.commit()
    conn.close()
    return new_id


# ----- Attempts -----

def get_attempt(exam_id, student_id):
    return _one("SELECT * FROM attempts WHERE exam_id = ? AND student_id = ?",
                (exam_id, student_id))


def get_attempt_by_id(attempt_id):
    return _one("SELECT * FROM attempts WHERE id = ?", (attempt_id,))


def create_attempt(exam_id, student_id, started_at, deadline):
    """UNIQUE(exam_id, student_id) guarantees only one attempt even on double clicks."""
    try:
        _run("INSERT INTO attempts (exam_id, student_id, started_at, deadline) VALUES (?, ?, ?, ?)",
             (exam_id, student_id, started_at, deadline))
    except sqlite3.IntegrityError:
        pass
    return get_attempt(exam_id, student_id)


def save_answer(attempt_id, exam_question_id, selected, review):
    _run(
        """INSERT INTO attempt_answers (attempt_id, exam_question_id, selected, marked_review, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(attempt_id, exam_question_id) DO UPDATE SET
               selected = excluded.selected,
               marked_review = excluded.marked_review,
               updated_at = excluded.updated_at""",
        (attempt_id, exam_question_id, selected, 1 if review else 0, now_str()),
    )


def get_attempt_answers(attempt_id):
    rows = _all("SELECT exam_question_id, selected, marked_review FROM attempt_answers WHERE attempt_id = ?",
                (attempt_id,))
    return {r["exam_question_id"]: {"selected": r["selected"], "review": bool(r["marked_review"])}
            for r in rows}


def finalize_attempt(attempt_id, status="submitted"):
    """Grade from STORED answers and close the attempt. Returns True if this call closed it.

    The UPDATE only matches while status is 'in_progress', so a double submit
    can never create a second result.
    """
    att = get_attempt_by_id(attempt_id)
    if att is None or att["status"] != "in_progress":
        return False
    questions = get_exam_questions_full(att["exam_id"])
    answers = get_attempt_answers(attempt_id)
    marks = total = correct = wrong = unanswered = 0
    for q in questions:
        total += q["marks"]
        sel = (answers.get(q["id"]) or {}).get("selected")
        if not sel:
            unanswered += 1
        elif sel == q["correct_option"]:
            correct += 1
            marks += q["marks"]
        else:
            wrong += 1
    pct = round(marks / total * 100, 2) if total else 0.0

    started = parse_time(att["started_at"])
    deadline = parse_time(att["deadline"])
    submitted = min(datetime.now(), deadline) if status == "auto_submitted" else datetime.now()
    taken = max(int((submitted - started).total_seconds()), 0)

    _, count = _run(
        """UPDATE attempts SET status = ?, submitted_at = ?, marks = ?, total_marks = ?,
               percentage = ?, correct_count = ?, wrong_count = ?, unanswered_count = ?,
               time_taken_seconds = ?
           WHERE id = ? AND status = 'in_progress'""",
        (status, submitted.strftime(TIME_FMT), marks, total, pct, correct, wrong,
         unanswered, taken, attempt_id),
    )
    return count == 1


def attempts_for_exam(exam_id):
    return _all(
        """SELECT a.*, s.name, s.reg_no FROM attempts a JOIN students s ON s.id = a.student_id
           WHERE a.exam_id = ? ORDER BY s.reg_no""", (exam_id,))


def attempts_for_student(student_id):
    return _all(
        """SELECT a.*, e.title, e.subject, e.results_released FROM attempts a
           JOIN exams e ON e.id = a.exam_id WHERE a.student_id = ? ORDER BY a.id DESC""",
        (student_id,))


def all_attempts(owner_id=None):
    """Submitted attempts with student + exam info (optionally only one teacher's exams)."""
    sql = """SELECT a.*, s.name, s.reg_no, e.title FROM attempts a
             JOIN students s ON s.id = a.student_id JOIN exams e ON e.id = a.exam_id
             WHERE a.status != 'in_progress'"""
    params = []
    if owner_id is not None:
        sql += " AND e.created_by = ?"
        params.append(owner_id)
    return _all(sql + " ORDER BY a.id DESC", params)


# ----- Analytics (computed from stored data only) -----

def exam_stats(exam_id, pass_percent=40):
    rows = _all("SELECT percentage FROM attempts WHERE exam_id = ? AND status != 'in_progress'", (exam_id,))
    if not rows:
        return None
    pcts = [r["percentage"] for r in rows]
    return {
        "submitted": len(pcts),
        "average": round(sum(pcts) / len(pcts), 1),
        "highest": max(pcts),
        "lowest": min(pcts),
        "pass_rate": round(100 * len([p for p in pcts if p >= pass_percent]) / len(pcts), 1),
    }


def question_stats(exam_id):
    return _all(
        """SELECT q.id, q.position, q.question, q.topic, q.marks,
            (SELECT COUNT(*) FROM attempt_answers aa JOIN attempts t ON t.id = aa.attempt_id
              WHERE aa.exam_question_id = q.id AND t.status != 'in_progress'
                AND aa.selected = q.correct_option) AS correct_count,
            (SELECT COUNT(*) FROM attempt_answers aa JOIN attempts t ON t.id = aa.attempt_id
              WHERE aa.exam_question_id = q.id AND t.status != 'in_progress'
                AND aa.selected IS NOT NULL) AS answered_count
           FROM exam_questions q WHERE q.exam_id = ? ORDER BY q.position, q.id""",
        (exam_id,))


def student_topic_performance(student_id):
    """Topic accuracy over this student's finished attempts whose results are released."""
    return _all(
        """SELECT CASE WHEN q.topic = '' THEN 'General' ELSE q.topic END AS topic,
               COUNT(*) AS total,
               SUM(CASE WHEN aa.selected = q.correct_option THEN 1 ELSE 0 END) AS correct
           FROM exam_questions q
           JOIN attempts t ON t.exam_id = q.exam_id AND t.student_id = ? AND t.status != 'in_progress'
           JOIN exams e ON e.id = q.exam_id AND e.results_released = 1
           LEFT JOIN attempt_answers aa ON aa.attempt_id = t.id AND aa.exam_question_id = q.id
           GROUP BY 1 ORDER BY 1""",
        (student_id,))


def seed_default_exam_if_missing():
    """Turn the pre-existing single question bank into a first published exam.

    Runs only when there are no exams yet, so the old 'one global exam' keeps
    working for students (results are shown immediately, like before).
    """
    if list_exams():
        return
    questions = get_all_questions()
    if not questions:
        return
    admin = get_student_by_reg_no("ADMIN")
    exam_id = create_exam(admin["id"] if admin else 0, {
        "title": "DSA Fundamentals",
        "description": "Sample multiple-choice exam on core data structures and Python basics.",
        "instructions": "",
        "subject": "Data Structures & Algorithms",
        "duration_minutes": max(len(questions), 5),
        "start_time": None, "end_time": None, "results_released": 1,
    })
    add_questions_to_exam(exam_id, [q["id"] for q in questions])
    set_exam_status(exam_id, "published")
