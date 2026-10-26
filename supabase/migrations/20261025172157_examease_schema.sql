/*
# ExamEase core schema (fix attempt 4)

Casts row_number() to int in leaderboard_for_exam to match return type.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL, full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student','teacher')),
  department text, institution text, student_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON profiles TO authenticated;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION upsert_my_profile(p_full_name text, p_role text, p_department text DEFAULT NULL, p_institution text DEFAULT NULL, p_student_id text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing text;
BEGIN
  IF p_role NOT IN ('student','teacher') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT role INTO v_existing FROM profiles WHERE id = auth.uid();
  IF v_existing IS NULL THEN
    INSERT INTO profiles (id, email, full_name, role, department, institution, student_id)
    SELECT auth.uid(), u.email, p_full_name, p_role, p_department, p_institution, p_student_id
    FROM auth.users u WHERE u.id = auth.uid();
  ELSIF v_existing <> p_role THEN RAISE EXCEPTION 'Role is already set and cannot be changed'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION upsert_my_profile(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_my_profile(text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION my_role() RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT role FROM profiles WHERE id = auth.uid(); $$;
REVOKE EXECUTE ON FUNCTION my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_role() TO authenticated;

CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, subject text NOT NULL, description text, instructions text,
  duration_min int NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  total_marks int NOT NULL DEFAULT 100 CHECK (total_marks > 0),
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz NOT NULL DEFAULT now() + interval '1 day',
  max_attempts int NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
  negative_marking numeric NOT NULL DEFAULT 0 CHECK (negative_marking >= 0 AND negative_marking <= 1),
  shuffle_questions boolean NOT NULL DEFAULT false,
  shuffle_choices boolean NOT NULL DEFAULT false,
  results_visible boolean NOT NULL DEFAULT true,
  explanations_visible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON exams TO authenticated;
GRANT INSERT, UPDATE, DELETE ON exams TO authenticated;
DROP POLICY IF EXISTS "exams_select" ON exams;
CREATE POLICY "exams_select" ON exams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "exams_insert_teacher" ON exams;
CREATE POLICY "exams_insert_teacher" ON exams FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND my_role() = 'teacher');
DROP POLICY IF EXISTS "exams_update_owner_teacher" ON exams;
CREATE POLICY "exams_update_owner_teacher" ON exams FOR UPDATE TO authenticated USING (auth.uid() = owner_id AND my_role() = 'teacher') WITH CHECK (auth.uid() = owner_id AND my_role() = 'teacher');
DROP POLICY IF EXISTS "exams_delete_owner_teacher" ON exams;
CREATE POLICY "exams_delete_owner_teacher" ON exams FOR DELETE TO authenticated USING (auth.uid() = owner_id AND my_role() = 'teacher');
CREATE INDEX IF NOT EXISTS exams_status_idx ON exams(status);
CREATE INDEX IF NOT EXISTS exams_owner_idx ON exams(owner_id);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL, topic text NOT NULL DEFAULT 'General',
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  marks int NOT NULL DEFAULT 1 CHECK (marks > 0),
  type text NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq','tf')),
  question_text text NOT NULL, choices jsonb NOT NULL, correct_index int NOT NULL,
  explanation text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON questions TO authenticated;
DROP POLICY IF EXISTS "questions_select_owner" ON questions;
CREATE POLICY "questions_select_owner" ON questions FOR SELECT TO authenticated USING (auth.uid() = owner_id AND my_role() = 'teacher');
DROP POLICY IF EXISTS "questions_insert_teacher" ON questions;
CREATE POLICY "questions_insert_teacher" ON questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND my_role() = 'teacher');
DROP POLICY IF EXISTS "questions_update_owner_teacher" ON questions;
CREATE POLICY "questions_update_owner_teacher" ON questions FOR UPDATE TO authenticated USING (auth.uid() = owner_id AND my_role() = 'teacher') WITH CHECK (auth.uid() = owner_id AND my_role() = 'teacher');
DROP POLICY IF EXISTS "questions_delete_owner_teacher" ON questions;
CREATE POLICY "questions_delete_owner_teacher" ON questions FOR DELETE TO authenticated USING (auth.uid() = owner_id AND my_role() = 'teacher');
CREATE INDEX IF NOT EXISTS questions_owner_idx ON questions(owner_id);
CREATE INDEX IF NOT EXISTS questions_subject_idx ON questions(subject);

CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (exam_id, question_id)
);
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON exam_questions TO authenticated;
DROP POLICY IF EXISTS "exam_questions_select" ON exam_questions;
CREATE POLICY "exam_questions_select" ON exam_questions FOR SELECT TO authenticated USING (true);
GRANT INSERT, DELETE ON exam_questions TO authenticated;
DROP POLICY IF EXISTS "exam_questions_modify_owner" ON exam_questions;
CREATE POLICY "exam_questions_modify_owner" ON exam_questions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_id AND e.owner_id = auth.uid() AND my_role()='teacher'));
DROP POLICY IF EXISTS "exam_questions_delete_owner" ON exam_questions;
CREATE POLICY "exam_questions_delete_owner" ON exam_questions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_id AND e.owner_id = auth.uid() AND my_role()='teacher'));
CREATE INDEX IF NOT EXISTS exam_questions_exam_idx ON exam_questions(exam_id);

CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','auto_submitted')),
  score numeric NOT NULL DEFAULT 0,
  total_marks numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  time_taken_sec int,
  shuffled_question_order jsonb,
  shuffled_choices_map jsonb,
  UNIQUE (exam_id, user_id, status)
);
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON attempts TO authenticated;
DROP POLICY IF EXISTS "attempts_select_own_or_exam_owner" ON attempts;
CREATE POLICY "attempts_select_own_or_exam_owner" ON attempts FOR SELECT TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM exams e WHERE e.id = attempts.exam_id AND e.owner_id = auth.uid()));
DROP POLICY IF EXISTS "attempts_insert_own" ON attempts;
CREATE POLICY "attempts_insert_own" ON attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "attempts_update_own" ON attempts;
CREATE POLICY "attempts_update_own" ON attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS attempts_exam_user_idx ON attempts(exam_id, user_id);
CREATE INDEX IF NOT EXISTS attempts_user_idx ON attempts(user_id);

CREATE TABLE IF NOT EXISTS responses (
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_index int, is_correct boolean, marks_awarded numeric,
  PRIMARY KEY (attempt_id, question_id)
);
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
GRANT SELECT (attempt_id, question_id, selected_index) ON responses TO authenticated;
DROP POLICY IF EXISTS "responses_select_own_or_owner" ON responses;
CREATE POLICY "responses_select_own_or_owner" ON responses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND (a.user_id = auth.uid() OR EXISTS (SELECT 1 FROM exams e WHERE e.id=a.exam_id AND e.owner_id=auth.uid()))));
GRANT INSERT ON responses TO authenticated;
DROP POLICY IF EXISTS "responses_insert_own" ON responses;
CREATE POLICY "responses_insert_own" ON responses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS responses_attempt_idx ON responses(attempt_id);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  title text NOT NULL, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON announcements TO authenticated;
DROP POLICY IF EXISTS "ann_select" ON announcements;
CREATE POLICY "ann_select" ON announcements FOR SELECT TO authenticated USING (true);
GRANT INSERT, UPDATE, DELETE ON announcements TO authenticated;
DROP POLICY IF EXISTS "ann_insert_teacher" ON announcements;
CREATE POLICY "ann_insert_teacher" ON announcements FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND my_role()='teacher');
DROP POLICY IF EXISTS "ann_update_teacher" ON announcements;
CREATE POLICY "ann_update_teacher" ON announcements FOR UPDATE TO authenticated USING (auth.uid() = owner_id AND my_role()='teacher') WITH CHECK (auth.uid() = owner_id AND my_role() = 'teacher');
DROP POLICY IF EXISTS "ann_delete_teacher" ON announcements;
CREATE POLICY "ann_delete_teacher" ON announcements FOR DELETE TO authenticated USING (auth.uid() = owner_id AND my_role() = 'teacher');
CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements(created_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON bookmarks TO authenticated;
DROP POLICY IF EXISTS "bm_select_own" ON bookmarks;
CREATE POLICY "bm_select_own" ON bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "bm_insert_own" ON bookmarks;
CREATE POLICY "bm_insert_own" ON bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "bm_delete_own" ON bookmarks;
CREATE POLICY "bm_delete_own" ON bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL, topic text NOT NULL DEFAULT 'General',
  difficulty text NOT NULL DEFAULT 'medium',
  score int NOT NULL DEFAULT 0, total int NOT NULL DEFAULT 1,
  time_sec int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON practice_attempts TO authenticated;
DROP POLICY IF EXISTS "pa_select_own" ON practice_attempts;
CREATE POLICY "pa_select_own" ON practice_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "pa_insert_own" ON practice_attempts;
CREATE POLICY "pa_insert_own" ON practice_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS practice_attempts_user_idx ON practice_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL, awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON achievements TO authenticated;
DROP POLICY IF EXISTS "ach_select_own" ON achievements;
CREATE POLICY "ach_select_own" ON achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ach_insert_own" ON achievements;
CREATE POLICY "ach_insert_own" ON achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS achievements_user_idx ON achievements(user_id);

CREATE OR REPLACE FUNCTION start_exam(p_exam_id uuid)
RETURNS TABLE (attempt_id uuid, questions jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam exams%ROWTYPE; v_existing int; v_order uuid[];
  v_choices_map jsonb := '{}'::jsonb; v_questions_out jsonb := '[]'::jsonb;
  v_qid uuid; v_text text; v_choices jsonb; v_type text; v_marks int; v_topic text; v_diff text;
  v_choice_arr text[]; v_choice_order int[]; v_reordered text[]; new_attempt_id uuid; n int;
BEGIN
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam not found'; END IF;
  IF v_exam.status <> 'published' THEN RAISE EXCEPTION 'Exam is not published'; END IF;
  IF now() < v_exam.start_time THEN RAISE EXCEPTION 'Exam has not started yet'; END IF;
  IF now() > v_exam.end_time THEN RAISE EXCEPTION 'Exam window has closed'; END IF;
  SELECT count(*) INTO v_existing FROM attempts WHERE exam_id = p_exam_id AND user_id = auth.uid() AND status IN ('in_progress','submitted','auto_submitted');
  IF v_existing >= v_exam.max_attempts THEN RAISE EXCEPTION 'Maximum attempts reached'; END IF;
  SELECT array_agg(q.id ORDER BY eq.position) INTO v_order FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = p_exam_id;
  IF v_order IS NULL OR array_length(v_order,1) IS NULL THEN RAISE EXCEPTION 'Exam has no questions'; END IF;
  IF v_exam.shuffle_questions THEN v_order := array_shuffle(v_order); END IF;
  FOREACH v_qid IN ARRAY v_order LOOP
    SELECT q.question_text, q.choices, q.type, q.marks, q.topic, q.difficulty INTO v_text, v_choices, v_type, v_marks, v_topic, v_diff FROM questions q WHERE q.id = v_qid;
    v_choice_arr := ARRAY(SELECT jsonb_array_elements_text(v_choices));
    n := array_length(v_choice_arr,1);
    IF v_exam.shuffle_choices THEN
      v_choice_order := array_shuffle(array(SELECT g FROM generate_series(0, n-1) AS g));
    ELSE
      v_choice_order := array(SELECT g FROM generate_series(0, n-1) AS g);
    END IF;
    v_choices_map := v_choices_map || jsonb_build_object(v_qid::text, to_jsonb(v_choice_order));
    v_reordered := ARRAY(SELECT v_choice_arr[g+1] FROM unnest(v_choice_order) WITH ORDINALITY AS t(g));
    v_questions_out := v_questions_out || jsonb_build_array(jsonb_build_object('id', v_qid, 'text', v_text, 'choices', to_jsonb(v_reordered), 'display_order', to_jsonb(v_choice_order), 'type', v_type, 'marks', v_marks, 'topic', v_topic, 'difficulty', v_diff));
  END LOOP;
  INSERT INTO attempts (exam_id, user_id, status, total_marks, shuffled_question_order, shuffled_choices_map) VALUES (p_exam_id, auth.uid(), 'in_progress', v_exam.total_marks, to_jsonb(v_order), v_choices_map) RETURNING id INTO new_attempt_id;
  attempt_id := new_attempt_id; questions := v_questions_out;
  RETURN NEXT;
END $$;
REVOKE EXECUTE ON FUNCTION start_exam(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_exam(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION submit_exam(p_attempt_id uuid, p_answers jsonb, p_auto boolean DEFAULT false)
RETURNS TABLE (score numeric, total_marks numeric, correct_count int, incorrect_count int, unanswered_count int, percentage numeric, status text, time_taken_sec int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attempt attempts%ROWTYPE; v_exam exams%ROWTYPE; v_over boolean; v_ans jsonb; v_qid uuid; v_sel int;
  v_q questions%ROWTYPE; v_display_order int[]; v_actual_choice int; v_marks numeric;
  v_correct int := 0; v_incorrect int := 0; v_unanswered int := 0; v_total numeric := 0; v_elapsed int;
BEGIN
  SELECT * INTO v_attempt FROM attempts WHERE id = p_attempt_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_attempt.status <> 'in_progress' THEN RAISE EXCEPTION 'Already submitted'; END IF;
  SELECT * INTO v_exam FROM exams WHERE id = v_attempt.exam_id;
  v_elapsed := extract(epoch FROM (now() - v_attempt.started_at))::int;
  v_over := v_elapsed > v_exam.duration_min * 60;
  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    v_qid := (v_ans->>'question_id')::uuid;
    v_sel := NULLIF(v_ans->>'selected_index','')::int;
    SELECT * INTO v_q FROM questions WHERE id = v_qid;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_display_order := ARRAY(SELECT jsonb_array_elements_text(v_attempt.shuffled_choices_map -> (v_qid::text))::int);
    IF v_sel IS NOT NULL AND v_display_order IS NOT NULL AND v_sel+1 <= array_length(v_display_order,1) THEN
      v_actual_choice := v_display_order[v_sel+1];
    ELSE
      v_actual_choice := v_sel;
    END IF;
    IF v_actual_choice IS NULL THEN v_unanswered := v_unanswered + 1; v_marks := 0;
    ELSIF v_actual_choice = v_q.correct_index THEN v_correct := v_correct + 1; v_marks := v_q.marks;
    ELSE v_incorrect := v_incorrect + 1; v_marks := - (v_exam.negative_marking * v_q.marks); END IF;
    v_total := v_total + v_marks;
    INSERT INTO responses (attempt_id, question_id, selected_index, is_correct, marks_awarded) VALUES (p_attempt_id, v_qid, v_actual_choice, v_actual_choice IS NOT NULL AND v_actual_choice = v_q.correct_index, v_marks) ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_index = EXCLUDED.selected_index, is_correct = EXCLUDED.is_correct, marks_awarded = EXCLUDED.marks_awarded;
  END LOOP;
  IF v_total < 0 THEN v_total := 0; END IF;
  UPDATE attempts SET status = CASE WHEN p_auto OR v_over THEN 'auto_submitted' ELSE 'submitted' END, score = v_total, submitted_at = now(), time_taken_sec = LEAST(v_elapsed, v_exam.duration_min * 60) WHERE id = p_attempt_id;
  score := v_total; total_marks := v_exam.total_marks; correct_count := v_correct; incorrect_count := v_incorrect; unanswered_count := v_unanswered;
  percentage := CASE WHEN v_exam.total_marks > 0 THEN round((v_total / v_exam.total_marks) * 100, 2) ELSE 0 END;
  status := CASE WHEN p_auto OR v_over THEN 'auto_submitted' ELSE 'submitted' END;
  time_taken_sec := LEAST(v_elapsed, v_exam.duration_min * 60);
  RETURN NEXT;
END $$;
REVOKE EXECUTE ON FUNCTION submit_exam(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_exam(uuid, jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION get_attempt_review(p_attempt_id uuid)
RETURNS TABLE (question_id uuid, question_text text, choices jsonb, display_order jsonb, selected_index int, correct_index int, is_correct boolean, marks_awarded numeric, explanation text, topic text, marks int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_attempt attempts%ROWTYPE; v_exam exams%ROWTYPE; v_is_owner boolean;
BEGIN
  SELECT * INTO v_attempt FROM attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  SELECT * INTO v_exam FROM exams WHERE id = v_attempt.exam_id;
  v_is_owner := (auth.uid() = v_attempt.user_id) OR (EXISTS (SELECT 1 FROM exams e WHERE e.id=v_attempt.exam_id AND e.owner_id=auth.uid()));
  IF NOT v_is_owner THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF auth.uid() = v_attempt.user_id AND NOT v_exam.results_visible THEN RAISE EXCEPTION 'Results are not yet available for this exam'; END IF;
  RETURN QUERY
    SELECT q.id, q.question_text, q.choices, v_attempt.shuffled_choices_map -> (q.id::text) AS display_order, r.selected_index,
           CASE WHEN v_exam.results_visible THEN q.correct_index ELSE NULL END AS correct_index,
           r.is_correct,
           CASE WHEN v_exam.results_visible THEN r.marks_awarded ELSE NULL END AS marks_awarded,
           CASE WHEN v_exam.explanations_visible THEN q.explanation ELSE NULL END AS explanation,
           q.topic, q.marks
    FROM responses r JOIN questions q ON q.id = r.question_id WHERE r.attempt_id = p_attempt_id;
END $$;
REVOKE EXECUTE ON FUNCTION get_attempt_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_attempt_review(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION leaderboard_for_exam(p_exam_id uuid)
RETURNS TABLE (rank int, user_id uuid, full_name text, score numeric, total_marks numeric, percentage numeric, submitted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT row_number() OVER (ORDER BY a.score DESC, a.submitted_at ASC)::int AS rank,
           a.user_id, p.full_name, a.score, a.total_marks,
           round((a.score / NULLIF(a.total_marks,0)) * 100, 2) AS percentage,
           a.submitted_at
    FROM attempts a JOIN profiles p ON p.id = a.user_id
    WHERE a.exam_id = p_exam_id AND a.status IN ('submitted','auto_submitted')
    ORDER BY rank;
END $$;
REVOKE EXECUTE ON FUNCTION leaderboard_for_exam(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION leaderboard_for_exam(uuid) TO authenticated;
