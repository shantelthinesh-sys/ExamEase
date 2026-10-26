// ExamEase exam page JavaScript
// Timer, navigation, mark-for-review, autosave and submission.
// The score is NOT calculated here - it is calculated on the server.

var cfg = {};
var questions = [];
var currentIndex = 0;
var answers = {};       // { question_id: "a" / "b" / "c" / "d" }
var reviewMarks = {};   // { question_id: true }
var dirty = {};         // question ids whose latest state is not yet saved on the server
var versions = {};      // per-question change counter (to ignore out-of-date save replies)
var inFlight = {};
var endTime = 0;        // ms timestamp when the server-side deadline is reached
var timerId = null;
var submitted = false;
var autoStarted = false;   // time-up submit is triggered once, then retried by submitFailed
var backupKey = "";

function init() {
  var el = document.getElementById("exam-config");
  cfg = { examId: el.dataset.examId, csrf: el.dataset.csrf };
  questions = JSON.parse(document.getElementById("questions-data").textContent);
  var saved = JSON.parse(document.getElementById("saved-data").textContent);

  // Start from what the server already has.
  for (var key in saved) {
    if (saved[key].selected) answers[key] = saved[key].selected;
    if (saved[key].review) reviewMarks[key] = true;
  }

  // Recover answers that could not be saved earlier (e.g. network dropped).
  backupKey = "examease-backup-" + cfg.examId;
  try {
    var b = JSON.parse(localStorage.getItem(backupKey) || "null");
    if (b && b.dirty) {
      for (var id in b.dirty) {
        if (b.answers[id]) answers[id] = b.answers[id]; else delete answers[id];
        if (b.review[id]) reviewMarks[id] = true; else delete reviewMarks[id];
        dirty[id] = true;
      }
      setStatus("Recovered unsaved answers - saving...", "warn");
    }
  } catch (e) { /* storage unavailable - fine */ }

  endTime = Date.now() + parseInt(el.dataset.remaining, 10) * 1000;
  renderQuestion();
  startTimer();
  setInterval(retryDirty, 8000);
  retryDirty();
  window.addEventListener("beforeunload", function (ev) {
    if (!submitted && Object.keys(dirty).length) { ev.preventDefault(); ev.returnValue = ""; }
  });
}

// ---------- rendering ----------

function renderQuestion() {
  var q = questions[currentIndex];
  document.getElementById("question-number").textContent = "Question " + (currentIndex + 1) + " of " + questions.length;
  document.getElementById("question-marks").textContent = q.marks + (q.marks === 1 ? " mark" : " marks");
  document.getElementById("question-text").textContent = q.question;

  var box = document.getElementById("options");
  box.innerHTML = "";
  var opts = [["a", q.option_a], ["b", q.option_b], ["c", q.option_c], ["d", q.option_d]];
  opts.forEach(function (o) {
    var label = document.createElement("label");
    var radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "option";
    radio.value = o[0];
    radio.checked = answers[q.id] === o[0];
    radio.onclick = function () { selectOption(this.value); };
    label.appendChild(radio);
    label.appendChild(document.createTextNode(" " + o[0] + ") " + o[1]));
    box.appendChild(label);
  });

  document.getElementById("prev-btn").disabled = (currentIndex === 0);
  document.getElementById("next-btn").disabled = (currentIndex === questions.length - 1);
  document.getElementById("clear-btn").disabled = !answers[q.id];
  document.getElementById("review-btn").textContent = reviewMarks[q.id] ? "Remove Review Mark" : "Mark for Review";
  renderNav();
}

function pillClass(i) {
  var q = questions[i];
  var c = "q-pill";
  if (answers[q.id]) c += " answered";
  if (reviewMarks[q.id]) c += " review";
  return c;
}

function renderNav() {
  var box = document.getElementById("question-nav");
  box.innerHTML = "";
  questions.forEach(function (q, i) {
    var pill = document.createElement("span");
    pill.className = pillClass(i) + (i === currentIndex ? " current" : "");
    pill.textContent = i + 1;
    pill.onclick = function () { goToQuestion(i); };
    box.appendChild(pill);
  });
  var n = Object.keys(answers).length;
  document.getElementById("progress-text").textContent = n + " of " + questions.length + " answered";
  document.getElementById("progress-bar").style.width = (questions.length ? (100 * n / questions.length) : 0) + "%";
}

// ---------- answering ----------

function selectOption(letter) {
  var id = questions[currentIndex].id;
  answers[id] = letter;
  changed(id);
  document.getElementById("clear-btn").disabled = false;
}

function clearAnswer() {
  var id = questions[currentIndex].id;
  delete answers[id];
  var radios = document.getElementsByName("option");
  for (var i = 0; i < radios.length; i++) radios[i].checked = false;
  document.getElementById("clear-btn").disabled = true;
  changed(id);
}

function toggleReview() {
  var id = questions[currentIndex].id;
  if (reviewMarks[id]) delete reviewMarks[id]; else reviewMarks[id] = true;
  document.getElementById("review-btn").textContent = reviewMarks[id] ? "Remove Review Mark" : "Mark for Review";
  changed(id);
}

function changed(id) {
  versions[id] = (versions[id] || 0) + 1;
  dirty[id] = true;
  writeBackup();
  renderNav();
  saveQuestion(id);
}

// ---------- navigation ----------

function nextQuestion() {
  if (currentIndex < questions.length - 1) {
    recordVisit(currentIndex);          // DSA: Stack on the server (per student)
    currentIndex++;
    renderQuestion();
  }
}

function previousQuestion() {
  if (currentIndex > 0) { currentIndex--; renderQuestion(); }
}

function goToQuestion(index) {
  if (index >= 0 && index < questions.length) { currentIndex = index; renderQuestion(); }
}

// ---------- autosave ----------

function post(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": cfg.csrf },
    body: JSON.stringify(body),
  });
}

function setStatus(text, kind) {
  var el = document.getElementById("save-status");
  el.textContent = text;
  el.className = "save-status " + (kind || "");
}

function saveQuestion(id) {
  if (submitted || inFlight[id]) return;
  inFlight[id] = true;
  var sent = versions[id] || 0;
  setStatus("Saving...", "");
  post("/exam/" + cfg.examId + "/save", {
    question_id: id,
    selected: answers[id] || null,
    review: !!reviewMarks[id],
  })
    .then(function (resp) { return resp.json().then(function (d) { return { status: resp.status, data: d }; }); })
    .then(function (r) {
      inFlight[id] = false;
      if (r.data.ok) {
        if ((versions[id] || 0) === sent) delete dirty[id];
        else saveQuestion(id);          // changed again while saving
        writeBackup();
        if (!Object.keys(dirty).length) setStatus("All changes saved at " + new Date().toLocaleTimeString(), "ok");
        if (typeof r.data.remaining === "number") endTime = Date.now() + r.data.remaining * 1000;
      } else if (r.status === 409) {
        setStatus(r.data.error || "This exam is closed.", "error");
        submitExam(true);               // server says the attempt is over - go to the result
      } else {
        setStatus("Could not save - will retry", "error");
      }
    })
    .catch(function () {
      inFlight[id] = false;
      setStatus("Offline - answers are kept and will be saved when you reconnect", "error");
    });
}

function retryDirty() {
  for (var id in dirty) saveQuestion(id);
}

function writeBackup() {
  try {
    if (!Object.keys(dirty).length) { localStorage.removeItem(backupKey); return; }
    localStorage.setItem(backupKey, JSON.stringify({ answers: answers, review: reviewMarks, dirty: dirty }));
  } catch (e) { /* ignore */ }
}

// ---------- timer ----------

function startTimer() {
  if (timerId) clearInterval(timerId);
  tick();
  timerId = setInterval(tick, 500);
}

function tick() {
  var left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  var m = Math.floor(left / 60), s = left % 60;
  var el = document.getElementById("timer");
  el.textContent = m + ":" + (s < 10 ? "0" + s : s);
  el.className = left <= 60 ? "timer warning" : "timer";
  if (left <= 0 && !submitted && !autoStarted) {
    autoStarted = true;
    setStatus("Time is up - submitting your exam...", "warn");
    submitExam(true);
  }
}

// ---------- review screen + submission ----------

function showSubmitDialog() {
  var answered = 0, marked = 0;
  var grid = document.getElementById("review-grid");
  grid.innerHTML = "";
  questions.forEach(function (q, i) {
    if (answers[q.id]) answered++;
    if (reviewMarks[q.id]) marked++;
    var pill = document.createElement("span");
    pill.className = pillClass(i);
    pill.textContent = i + 1;
    pill.onclick = function () { hideSubmitDialog(); goToQuestion(i); };
    grid.appendChild(pill);
  });
  document.getElementById("confirm-answered").textContent = answered;
  document.getElementById("confirm-unanswered").textContent = questions.length - answered;
  document.getElementById("confirm-review").textContent = marked;
  document.getElementById("overlay").style.display = "block";
  document.getElementById("confirm-box").style.display = "block";
}

function hideSubmitDialog() {
  document.getElementById("overlay").style.display = "none";
  document.getElementById("confirm-box").style.display = "none";
}

function submitExam(auto) {
  if (submitted) return;
  submitted = true;
  hideSubmitDialog();
  document.getElementById("submit-error").style.display = "none";
  var btn = document.getElementById("submit-btn");
  if (btn) btn.disabled = true;
  setStatus("Submitting...", "");

  post("/exam/" + cfg.examId + "/submit", {
    answers: answers,
    review: Object.keys(reviewMarks),
    auto: !!auto,
  })
    .then(function (resp) { return resp.json(); })
    .then(function (data) {
      if (data.success && data.redirect) {
        try { localStorage.removeItem(backupKey); } catch (e) { }
        window.location.href = data.redirect;
      } else {
        submitFailed(data.error || "Submission failed.", auto);
      }
    })
    .catch(function () { submitFailed("Network error - your answers are kept on this page.", auto); });
}

function submitFailed(message, auto) {
  submitted = false;
  var btn = document.getElementById("submit-btn");
  if (btn) btn.disabled = false;
  document.getElementById("submit-error-text").textContent = message + " Please check your connection and retry.";
  document.getElementById("submit-error").style.display = "block";
  setStatus("Not submitted yet", "error");
  if (auto) setTimeout(function () { submitExam(true); }, 5000);   // keep trying after time-up
}

// Record a visited question index on the server stack (DSA: Stack).
function recordVisit(index) {
  post("/exam/visit", { index: index }).catch(function () { });
}

window.onload = init;
