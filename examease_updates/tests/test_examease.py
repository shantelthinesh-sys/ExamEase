"""End-to-end tests for ExamEase (run from the project folder):

    python -m unittest discover -s tests -v

Uses a temporary database, so your real exam.db is never touched.
"""
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database as db  # noqa: E402

_tmp = tempfile.mkdtemp()
db.DB_PATH = os.path.join(_tmp, "test.db")

import app as app_module  # noqa: E402

app = app_module.app
app.config["TESTING"] = True


class Client:
    """Small wrapper that handles the CSRF token for us."""

    def __init__(self):
        self.c = app.test_client()

    def token(self):
        self.c.get("/login")
        with self.c.session_transaction() as s:
            return s["_csrf"]

    def get(self, url, **kw):
        return self.c.get(url, **kw)

    def post(self, url, data=None, csrf=True, **kw):
        data = dict(data or {})
        if csrf:
            data["csrf_token"] = self.token()
        return self.c.post(url, data=data, **kw)

    def post_json(self, url, payload, csrf=True):
        headers = {"X-CSRF-Token": self.token()} if csrf else {}
        return self.c.post(url, json=payload, headers=headers)

    def login(self, reg_no, password):
        return self.post("/login", {"reg_no": reg_no, "password": password})


def question_form(text="What is 2+2?", correct="b", **extra):
    f = {"question": text, "option_a": "3", "option_b": "4", "option_c": "5", "option_d": "6",
         "correct_option": correct, "subject": "Maths", "topic": "Arithmetic",
         "difficulty": "easy", "marks": "2", "explanation": "Basic addition."}
    f.update(extra)
    return f


class ExamEaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init_db()
        db.seed_questions_if_empty()
        db.seed_admin_if_missing()
        db.seed_default_exam_if_missing()
        admin = Client()
        admin.login("ADMIN", "admin123")
        for reg, role in (("T001", "teacher"), ("T002", "teacher")):
            admin.post("/admin/users", {"name": "Teacher " + reg, "reg_no": reg,
                                        "password": "teachpass", "role": role})
        for reg in ("S001", "S002"):
            Client().post("/register", {"name": "Student " + reg, "reg_no": reg, "password": "pass1234"})

    def client_as(self, reg, pw):
        c = Client()
        r = c.login(reg, pw)
        self.assertEqual(r.status_code, 302, "login should redirect for " + reg)
        return c

    # ---------------- authentication & roles ----------------
    def test_01_auth_and_roles(self):
        bad = Client().login("S001", "wrong")
        self.assertIn(b"Invalid registration number or password", bad.data)
        self.assertEqual(Client().login("NOBODY", "x").status_code, 200)

        anon = Client()
        for url in ("/dashboard", "/teacher", "/admin", "/questions", "/exams/new", "/admin/users"):
            r = anon.get(url)
            self.assertEqual(r.status_code, 302)
            self.assertIn("/login", r.headers["Location"], url)

        self.assertIn("/dashboard", Client().login("S001", "pass1234").headers["Location"])
        self.assertIn("/teacher", Client().login("T001", "teachpass").headers["Location"])
        self.assertIn("/admin", Client().login("ADMIN", "admin123").headers["Location"])

        student = self.client_as("S001", "pass1234")
        for url in ("/teacher", "/questions", "/exams/new", "/admin", "/admin/users", "/search"):
            self.assertEqual(student.get(url).status_code, 302, url)       # redirected away
        teacher = self.client_as("T001", "teachpass")
        for url in ("/admin", "/admin/users", "/dashboard"):
            self.assertEqual(teacher.get(url).status_code, 302, url)
        self.assertEqual(teacher.get("/teacher").status_code, 200)

    def test_02_public_registration_cannot_create_privileged_users(self):
        c = Client()
        c.post("/register", {"name": "Evil", "reg_no": "ADMIN", "password": "pass1234"})
        c.post("/register", {"name": "Evil", "reg_no": "admin", "password": "pass1234"})
        c.post("/register", {"name": "Evil", "reg_no": "X1", "password": "pass1234", "role": "admin"})
        self.assertEqual(db.get_student_by_reg_no("X1")["role"], "student")
        self.assertIsNone(db.get_student_by_reg_no("admin"))
        self.assertEqual(db.get_student_by_reg_no("ADMIN")["role"], "admin")

    def test_03_csrf_is_enforced(self):
        c = Client()
        r = c.post("/login", {"reg_no": "S001", "password": "pass1234"}, csrf=False)
        self.assertEqual(r.status_code, 302)
        with c.c.session_transaction() as sess:
            self.assertNotIn("student_id", sess)           # login was refused
        c.token()                                           # now a session token exists...
        r = c.c.post("/login", data={"reg_no": "S001", "password": "pass1234", "csrf_token": "wrong"})
        with c.c.session_transaction() as sess:
            self.assertNotIn("student_id", sess)           # ...but a wrong token is refused
        s = self.client_as("S001", "pass1234")
        r = s.post_json("/exam/visit", {"index": 1}, csrf=False)
        self.assertEqual(r.status_code, 400)               # JSON endpoints need the header

    # ---------------- question bank ----------------
    def test_04_question_crud_persists_and_is_protected(self):
        t1 = self.client_as("T001", "teachpass")
        t2 = self.client_as("T002", "teachpass")
        # validation
        t1.post("/questions/add", question_form(marks="0"))
        t1.post("/questions/add", question_form(option_b="3"))     # duplicate option
        t1.post("/questions/add", question_form(correct="z"))
        self.assertEqual([q for q in db.list_questions() if q["subject"] == "Maths"], [])
        # create
        r = t1.post("/questions/add", question_form("CRUD question?"))
        self.assertEqual(r.status_code, 302)
        q = [x for x in db.list_questions() if x["question"] == "CRUD question?"][0]
        teacher1 = db.get_student_by_reg_no("T001")
        self.assertEqual(q["owner_id"], teacher1["id"])
        self.assertIn(b"CRUD question?", t1.get("/questions").data)          # visible after "refresh"
        # filter
        self.assertIn(b"CRUD question?", t1.get("/questions?topic=Arithmetic&difficulty=easy").data)
        self.assertNotIn(b"CRUD question?", t1.get("/questions?difficulty=hard").data)
        # another teacher cannot see/edit/delete it
        self.assertNotIn(b"CRUD question?", t2.get("/questions").data)
        t2.post("/questions/%d/edit" % q["id"], question_form("HACKED"))
        t2.post("/questions/%d/delete" % q["id"])
        self.assertEqual(db.get_question(q["id"])["question"], "CRUD question?")
        # student cannot
        s = self.client_as("S001", "pass1234")
        s.post("/questions/%d/delete" % q["id"])
        self.assertIsNotNone(db.get_question(q["id"]))
        # edit
        t1.post("/questions/%d/edit" % q["id"], question_form("CRUD question edited?"))
        self.assertEqual(db.get_question(q["id"])["question"], "CRUD question edited?")
        # delete
        t1.post("/questions/%d/delete" % q["id"])
        self.assertIsNone(db.get_question(q["id"]))

    # ---------------- exam lifecycle ----------------
    def make_published_exam(self, teacher, name="Exam A", n=3, release=1):
        c = self.client_as(teacher, "teachpass")
        for i in range(n):
            c.post("/questions/add", question_form("%s Q%d?" % (name, i), marks="2" if i else "3"))
        r = c.post("/exams/new", {"title": name, "subject": "Maths", "duration_minutes": "10",
                                  "description": "d", "instructions": "be quick",
                                  "results_released": "1" if release else ""})
        exam_id = int(r.headers["Location"].rstrip("/").split("/")[-1])
        return c, exam_id

    def test_05_full_exam_flow(self):
        t, eid = self.make_published_exam("T001", "Flow", release=0)
        # cannot publish an empty exam
        t.post("/exams/%d/publish" % eid)
        self.assertEqual(db.get_exam(eid)["status"], "draft")
        owner = db.get_student_by_reg_no("T001")["id"]
        ids = [q["id"] for q in db.list_questions(owner) if q["question"].startswith("Flow")]
        t.post("/exams/%d/questions/add" % eid, {"question_ids": ids})
        eqs = db.get_exam_questions_full(eid)
        self.assertEqual(len(eqs), 3)
        self.assertEqual(sum(q["marks"] for q in eqs), 3 + 2 + 2)
        # change marks
        t.post("/exams/%d/marks" % eid, {"marks_%d" % q["id"]: "4" for q in eqs})
        self.assertEqual(sum(q["marks"] for q in db.get_exam_questions_full(eid)), 12)
        t.post("/exams/%d/marks" % eid, {"marks_%d" % eqs[0]["id"]: "0"})      # invalid ignored
        self.assertEqual(sum(q["marks"] for q in db.get_exam_questions_full(eid)), 12)
        self.assertIn(b"Flow Q0?", t.get("/exams/%d/preview" % eid).data)

        s = self.client_as("S001", "pass1234")
        self.assertNotIn(b"Flow", s.get("/dashboard").data)                   # draft invisible
        self.assertEqual(s.get("/exam/%d/instructions" % eid).status_code, 404)

        t.post("/exams/%d/publish" % eid)
        self.assertEqual(db.get_exam(eid)["status"], "published")
        self.assertIn(b"Flow", s.get("/dashboard").data)
        self.assertIn(b"be quick", s.get("/exam/%d/instructions" % eid).data)

        # starting needs POST; GET /take without attempt goes to instructions
        self.assertEqual(s.get("/exam/%d/take" % eid).status_code, 302)
        s.post("/exam/%d/begin" % eid)
        s.post("/exam/%d/begin" % eid)                                         # double click
        sid = db.get_student_by_reg_no("S001")["id"]
        self.assertEqual(len([a for a in db.attempts_for_student(sid) if a["exam_id"] == eid]), 1)  # no duplicate attempt
        page = s.get("/exam/%d/take" % eid)
        self.assertEqual(page.status_code, 200)
        self.assertNotIn(b"correct_option", page.data)                        # answers never sent
        self.assertNotIn(b"Basic addition", page.data)                         # nor explanations

        # answer: q0 correct (b), q1 wrong (a), q2 unanswered
        eq = db.get_exam_questions_full(eid)
        r = s.post_json("/exam/%d/save" % eid, {"question_id": eq[0]["id"], "selected": "b", "review": True})
        self.assertTrue(r.get_json()["ok"])
        s.post_json("/exam/%d/save" % eid, {"question_id": eq[1]["id"], "selected": "a", "review": False})
        self.assertEqual(s.post_json("/exam/%d/save" % eid, {"question_id": 99999, "selected": "a"}).status_code, 400)
        self.assertEqual(s.post_json("/exam/%d/save" % eid, {"question_id": eq[1]["id"], "selected": "z"}).status_code, 400)
        att = db.get_attempt(eid, sid)
        saved = db.get_attempt_answers(att["id"])
        self.assertEqual(saved[eq[0]["id"]], {"selected": "b", "review": True})
        # resumed page restores saved answers
        self.assertIn(b'"selected": "b"', s.get("/exam/%d/take" % eid).data)

        # browser tries to cheat with a score and a wrong-looking payload
        r = s.post_json("/exam/%d/submit" % eid, {"answers": {str(eq[0]["id"]): "b", str(eq[1]["id"]): "a"},
                                                 "review": [eq[0]["id"]], "score": 100, "marks": 100})
        data = r.get_json()
        self.assertTrue(data["success"])
        # duplicate submit -> same result, no second attempt row
        r2 = s.post_json("/exam/%d/submit" % eid, {"answers": {str(eq[1]["id"]): "b"}})
        self.assertEqual(r2.get_json()["redirect"], data["redirect"])
        self.assertEqual(len([a for a in db.attempts_for_student(sid) if a["exam_id"] == eid]), 1)

        att = db.get_attempt(eid, sid)
        self.assertEqual((att["marks"], att["total_marks"], att["correct_count"],
                          att["wrong_count"], att["unanswered_count"]), (4, 12, 1, 1, 1))
        self.assertAlmostEqual(att["percentage"], 33.33, places=2)
        self.assertEqual(att["status"], "submitted")
        # re-opening the exam after submit goes to the result, answers cannot change
        self.assertEqual(s.get("/exam/%d/take" % eid).status_code, 302)
        self.assertEqual(s.post_json("/exam/%d/save" % eid, {"question_id": eq[1]["id"], "selected": "b"}).status_code, 409)
        self.assertEqual(db.get_attempt(eid, sid)["marks"], 4)

        # results hidden until released
        view = s.get("/result/%d" % att["id"])
        self.assertIn(b"Awaiting", s.get("/dashboard").data)
        self.assertIn(b"releases the results", view.data)
        self.assertNotIn(b"Correct answer", view.data)
        t.post("/exams/%d/release" % eid, {"release": "1"})
        view = s.get("/result/%d" % att["id"])
        self.assertIn(b"Correct answer", view.data)
        self.assertIn(b"Basic addition", view.data)
        self.assertIn(b"33.33%", view.data)

        # other student / other teacher cannot see it; owner teacher and admin can
        s2 = self.client_as("S002", "pass1234")
        self.assertEqual(s2.get("/result/%d" % att["id"]).status_code, 302)
        t2 = self.client_as("T002", "teachpass")
        self.assertEqual(t2.get("/result/%d" % att["id"]).status_code, 302)
        self.assertEqual(t2.get("/exams/%d/results" % eid).status_code, 403)
        self.assertEqual(t2.get("/exams/%d" % eid).status_code, 403)
        t2.post("/exams/%d/release" % eid, {"release": "0"})
        self.assertEqual(db.get_exam(eid)["results_released"], 1)
        self.assertEqual(t.get("/result/%d" % att["id"]).status_code, 200)
        a = self.client_as("ADMIN", "admin123")
        self.assertEqual(a.get("/result/%d" % att["id"]).status_code, 200)
        self.assertIn(b"Student S001", t.get("/exams/%d/results" % eid).data)

        # published exam is locked; snapshots protect history
        self.assertEqual(db.get_exam(eid)["status"], "published")
        t.post("/exams/%d/questions/%d/remove" % (eid, eq[0]["id"]))
        self.assertEqual(len(db.get_exam_questions_full(eid)), 3)
        t.post("/exams/%d/unpublish" % eid)                                    # has attempts
        self.assertEqual(db.get_exam(eid)["status"], "published")
        src = [q for q in db.list_questions(owner) if q["question"] == "Flow Q0?"][0]
        t.post("/questions/%d/edit" % src["id"], question_form("Flow Q0 CHANGED?", correct="a"))
        t.post("/questions/%d/delete" % src["id"])
        review = app_module.build_review(db.get_attempt_by_id(att["id"]))
        self.assertEqual(review[0]["q"]["question"], "Flow Q0?")
        self.assertEqual(review[0]["status"], "correct")
        self.assertEqual(db.get_attempt_by_id(att["id"])["marks"], 4)
        # duplicate gives a new editable draft
        r = t.post("/exams/%d/duplicate" % eid)
        new_id = int(r.headers["Location"].rstrip("/").split("/")[-1])
        self.assertEqual(db.get_exam(new_id)["status"], "draft")
        self.assertEqual(len(db.get_exam_questions_full(new_id)), 3)

    def test_06_deadline_is_enforced_by_server(self):
        t, eid = self.make_published_exam("T002", "Late")
        owner = db.get_student_by_reg_no("T002")["id"]
        t.post("/exams/%d/questions/add" % eid, {"question_ids": [q["id"] for q in db.list_questions(owner) if q["question"].startswith("Late")]})
        t.post("/exams/%d/publish" % eid)
        eq = db.get_exam_questions_full(eid)

        # student whose time ran out long ago: closed lazily, late payload ignored
        s = self.client_as("S002", "pass1234")
        s.post("/exam/%d/begin" % eid)
        sid = db.get_student_by_reg_no("S002")["id"]
        att = db.get_attempt(eid, sid)
        s.post_json("/exam/%d/save" % eid, {"question_id": eq[0]["id"], "selected": "b"})   # saved in time
        past = datetime.now() - timedelta(minutes=30)
        conn = db.get_connection()
        conn.execute("UPDATE attempts SET started_at=?, deadline=? WHERE id=?",
                     (past.strftime(db.TIME_FMT), (past + timedelta(minutes=10)).strftime(db.TIME_FMT), att["id"]))
        conn.commit(); conn.close()
        r = s.post_json("/exam/%d/save" % eid, {"question_id": eq[1]["id"], "selected": "b"})
        self.assertEqual(r.status_code, 409)
        r = s.post_json("/exam/%d/submit" % eid, {"answers": {str(eq[1]["id"]): "b", str(eq[2]["id"]): "b"}})
        self.assertTrue(r.get_json()["success"])
        att = db.get_attempt_by_id(att["id"])
        self.assertEqual(att["status"], "auto_submitted")
        self.assertEqual(att["correct_count"], 1)          # only the answer saved in time counts
        self.assertEqual(att["time_taken_seconds"], 600)   # capped at the allowed duration

    def test_07_availability_window_and_publish_validation(self):
        t = self.client_as("T001", "teachpass")
        soon = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
        past = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
        r = t.post("/exams/new", {"title": "Window", "duration_minutes": "5", "start_time": soon})
        eid = int(r.headers["Location"].rstrip("/").split("/")[-1])
        shared = [q["id"] for q in db.list_questions(db.get_student_by_reg_no("T001")["id"])][:1]
        t.post("/exams/%d/questions/add" % eid, {"question_ids": shared})
        t.post("/exams/%d/publish" % eid)
        s = self.client_as("S001", "pass1234")
        self.assertIn(b"Upcoming", s.get("/dashboard").data)
        s.post("/exam/%d/begin" % eid)
        self.assertIsNone(db.get_attempt(eid, db.get_student_by_reg_no("S001")["id"]))
        # bad forms
        self.assertEqual(t.post("/exams/new", {"title": "x", "duration_minutes": "5"}).status_code, 200)
        self.assertEqual(t.post("/exams/new", {"title": "Bad", "duration_minutes": "0"}).status_code, 200)
        self.assertEqual(t.post("/exams/new", {"title": "Bad dates", "duration_minutes": "5",
                                               "start_time": soon, "end_time": past}).status_code, 200)
        # end time in the past cannot be published
        r = t.post("/exams/new", {"title": "Ended", "duration_minutes": "5", "end_time": past})
        eid2 = int(r.headers["Location"].rstrip("/").split("/")[-1])
        t.post("/exams/%d/questions/add" % eid2, {"question_ids": shared})
        t.post("/exams/%d/publish" % eid2)
        self.assertEqual(db.get_exam(eid2)["status"], "draft")

    def test_08_admin_user_management(self):
        a = self.client_as("ADMIN", "admin123")
        stu = db.get_student_by_reg_no("S002")
        a.post("/admin/users/%d/role" % stu["id"], {"role": "teacher"})
        self.assertEqual(db.get_student_by_id(stu["id"])["role"], "teacher")
        a.post("/admin/users/%d/role" % stu["id"], {"role": "student"})
        admin_id = db.get_student_by_reg_no("ADMIN")["id"]
        a.post("/admin/users/%d/role" % admin_id, {"role": "student"})
        self.assertEqual(db.get_student_by_id(admin_id)["role"], "admin")
        # a teacher cannot do it (and role change takes effect immediately)
        t = self.client_as("T001", "teachpass")
        t.post("/admin/users/%d/role" % stu["id"], {"role": "teacher"})
        self.assertEqual(db.get_student_by_id(stu["id"])["role"], "student")
        self.assertIn(b"Admin Dashboard", a.get("/admin").data)

    def test_09_binary_search_by_reg_no(self):
        t = self.client_as("T001", "teachpass")
        r = t.post("/search", {"reg_no": "S001"})
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"Flow", r.data)
        self.assertIn(b"No result found", t.post("/search", {"reg_no": "NOPE"}).data)

    def test_10_legacy_sample_exam_migrated(self):
        exams = [e for e in db.list_exams() if e["title"] == "DSA Fundamentals"]
        self.assertEqual(len(exams), 1)
        self.assertEqual(exams[0]["status"], "published")
        self.assertEqual(exams[0]["question_count"], 6)


if __name__ == "__main__":
    unittest.main()
