# ExamEase - Online Examination System

**Exams Made Smarter. Algorithms Made Visible.**

A professional online examination platform with an integrated, interactive DSA
laboratory. Built as a college DSA microproject using **Python Flask + SQLite**
on the back end and **HTML, CSS, JavaScript (Vite)** on the front end.

The project combines two goals:
1. A fully functional online examination platform with student and admin roles.
2. An interactive DSA learning platform with step-by-step algorithm visualizers.

## Features

### Roles (Flask Backend)
- **Student** - registers publicly, sees available/upcoming exams, takes exams, views released results and analytics.
- **Teacher** - created by an admin (never by public registration). Question bank (add/edit/delete/search/filter/preview),
  exam creation (draft -> publish), marks, results, statistics, release of results.
- **Admin** - default account `ADMIN`; creates teachers, changes roles, sees all exams/questions/results.
- Every permission is checked on the server (`roles_required` decorators); editing URLs cannot grant access.

### Examination Platform (Flask Backend)
0. Exams: drafts, publishing, duration, optional open/close times, per-question marks, autosave,
   mark for review, clear answer, review screen, server-side deadline, results release, topic analytics.
1. Student registration with name, registration number, and password.
2. Student login and logout (passwords hashed with Werkzeug).
3. Exam instructions page.
4. MCQ exam with four options per question.
5. Countdown timer with auto-submit when time runs out.
6. Next and Previous buttons.
7. Question navigation panel showing answered and unanswered questions.
8. Submit button with confirmation dialog.
9. Server-side score calculation (never trusted to the browser).
10. Result page showing marks, correct answers, total questions, and percentage.
11. Dashboard showing previous results.
12. One attempt per student enforced server-side.
13. Admin login, add/edit/delete questions, view all results.
14. Admin binary search by registration number.

### DSA Lab (Interactive Visualizers — Vite Frontend)
- **Stack Visualizer**: Push, pop, peek, reset with LIFO visualization.
- **Hash Table Visualizer**: Insert, search, delete with separate chaining and collision demonstration.
- **Binary Search Visualizer**: Step through comparisons with low/high/mid highlighting, play/pause.
- **Merge Sort Visualizer**: Step through splits and merges, forward/backward navigation, play/pause.
- **Practice Mode**: MCQs, predict-the-output, and complexity questions for all four topics.
- **Learning Panel**: Each visualizer includes purpose, pseudocode, complexity, examples, and common mistakes.
- **Dark Mode**: Persisted light/dark theme toggle.
- **Responsive**: Works on desktop, tablet, and mobile.

### DSA Implementations (Python)
- **Stack** (`dsa/stack.py`) - push, pop, peek, is_empty, reset. Used for question navigation history.
- **Hash Table** (`dsa/hash_table.py`) - insert, search, delete with separate chaining. Used for student lookup at login.
- **Binary Search** (`dsa/binary_search.py`) - manual implementation. Used for admin result search.
- **Merge Sort** (`dsa/sorting.py`) - divide and conquer with in-place and copy variants.

## Project Structure

```
ExamEase/
├── app.py                  # Flask application (all routes)
├── database.py             # SQLite helpers + safe migration (roles, exams, attempts)
├── tests/test_examease.py  # End-to-end tests (python -m unittest discover -s tests -v)
├── requirements.txt        # Python dependencies
├── README.md
│
├── dsa/                    # Data Structures and Algorithms (Python)
│   ├── stack.py            # Stack with self-test
│   ├── hash_table.py       # Hash table with chaining, self-test
│   ├── binary_search.py    # Binary search, self-test
│   └── sorting.py          # Merge sort, self-test
│
├── static/                 # Flask static assets
│   ├── style.css           # Exam page CSS
│   └── exam.js             # Exam timer, navigation, submission
│
├── templates/              # Flask HTML templates
│   ├── base.html, index.html, register.html, login.html
│   ├── dashboard.html, instructions.html, exam.html
│   ├── result.html, admin_dashboard.html
│   ├── admin_question_form.html, search.html
│
├── index.html              # Vite entry point (preview)
├── package.json            # Vite dependencies
├── vite.config.js          # Vite configuration
├── src/                    # Vite frontend (DSA Lab + landing page)
│   ├── main.js             # SPA router, dark mode, navigation
│   ├── style.css           # Design system CSS
│   ├── dsa.js              # JS DSA implementations (Stack, Hash, Binary, Merge)
│   ├── practice-data.js    # Practice questions
│   └── pages/
│       ├── landing.js      # Professional landing page
│       ├── dsa-lab.js      # 4 interactive visualizers + learning panels
│       └── practice.js     # DSA practice mode
```

## Installation and Setup

### Prerequisites
- Python 3.8 or higher
- Node.js 18+ (for the Vite preview)
- VS Code (recommended)

### Running the Full Exam Application (Flask)

1. **Open the project folder in VS Code.**

2. **(Optional) Create a virtual environment:**
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```

3. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```

5. **Open the browser at:** http://127.0.0.1:5000

The SQLite database (`exam.db`) is created automatically. Sample MCQ questions
and a default admin account are also created automatically.

### Running the DSA Lab Preview (Vite)

The DSA Lab visualizers, landing page, and practice mode run in the Vite frontend:

```bash
npm install
npm run dev
```

Open http://localhost:5173 to see the landing page, DSA Lab, and practice mode.

## How to Use

### As a Student (Flask app)
1. Click **Register** and fill in your name, registration number, and password.
2. Log in with your registration number and password.
3. Read the exam instructions and click **Start Exam**.
4. Answer the MCQs using the options, Next/Previous buttons, or numbered pills.
5. Click **Submit Exam** and confirm. Your score is calculated on the server.
6. View your result. See past results on your dashboard.

### As an Admin (Flask app)
1. Log in with registration number **ADMIN** and password **admin123** (change it for real use).
2. Open **Users** to create teacher accounts or change a user's role.
3. View every exam, question and result.
4. Use **Search Result by Reg. No.** to find results using binary search.

### As a Teacher (Flask app)
1. Log in with the staff ID/password the admin created.
2. **Question Bank** -> Add Question (subject, topic, difficulty, marks, explanation; live student preview).
3. **New Exam** -> save a draft, add questions from the bank, adjust marks, preview, then **Publish**.
4. Open **Results** on an exam to see attempts, statistics and per-question analysis; release results to students.
5. Published exams are locked so attempts stay valid. Unpublish (only before any attempt) or **Duplicate** to make a new version.
   Questions are copied (snapshotted) into the exam, so later edits/deletes in the bank never change past exams or results.

### DSA Lab (Vite preview)
1. Navigate to **DSA Lab** from the navbar.
2. Switch between Stack, Hash Table, Binary Search, and Merge Sort tabs.
3. Enter data and click the operation buttons (push/pop, insert/search, etc.).
4. For Binary Search and Merge Sort, use Step/Play to walk through each step.
5. Click **Practice** to test your DSA knowledge with quiz questions.

## Testing the DSA Implementations

Each Python DSA file can be tested independently:

```bash
python dsa/stack.py        # Tests push, pop, peek, is_empty
python dsa/hash_table.py   # Tests insert, lookup, delete, collisions
python dsa/binary_search.py # Tests search on sorted array
python dsa/sorting.py      # Tests merge sort with edge cases
```

The JavaScript DSA implementations (`src/dsa.js`) power the visualizers and
generate step-by-step data for the interactive visualizations.

## Security Notes
- Passwords are hashed using Werkzeug's `generate_password_hash`.
- Correct answers are never sent to the browser during the exam.
- Score calculation happens entirely on the server.
- Students can only view their own results. Admins can view all.
- Admin and teacher pages are protected by server-side role checks; the role is re-read from the database on every request.
- CSRF tokens protect every form and fetch request.
- The session secret comes from `EXAMEASE_SECRET_KEY` or an auto-generated `secret.key` file (do not commit it).
- Duplicate exam submissions are prevented (one attempt per student).
- SQL queries use parameterized statements (no string concatenation).

## Limitations
- Only one exam (the full question bank) is available in the Flask app.
- The exam can only be attempted once per student.
- The admin account is stored in the users (`students`) table with the reserved ID `ADMIN`.
- The navigation stack is in memory (resets on server restart, exam still works).
- The Vite preview shows the DSA Lab, landing page, and practice mode. The full exam workflow requires the Flask server.
- No password reset feature.
- No password reset or rate limiting on login.
- Only multiple-choice (4 options) questions are supported; True/False is not (the grading model and database require four options).
- One attempt per student per exam. Time limit is checked by the server (30 s network grace); this does not prevent every form of cheating.
- The old single-exam results table (`results`) is kept untouched but no longer used; the old question bank became the exam "DSA Fundamentals".

## Built With
- Python + Flask (back end)
- SQLite (database)
- HTML, CSS, JavaScript (Flask templates)
- Werkzeug (password hashing)
- Vite + vanilla JS (DSA Lab frontend)
- Inter & Fira Code fonts
