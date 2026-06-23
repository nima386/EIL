const STORAGE_KEY = "quiz_arena_storage_v1";
const FLAG_BASE_PATH = "./flags/4x3";

function getStorageData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { firstAttempts: {}, lastResults: {} };
  } catch {
    return { firstAttempts: {}, lastResults: {} };
  }
}

function saveStorageData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getTodayString() {
  return new Date().toLocaleString("de-DE");
}

function formatNumber(num) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2
  }).format(num);
}

function parseGermanNumber(value) {
  if (value === null || value === undefined) return NaN;
  value = String(value).trim();
  if (!value) return NaN;

  value = value.replace(/\s/g, "");
  value = value.replace(/\.(?=\d{3}(\D|$))/g, "");
  value = value.replace(",", ".");

  return parseFloat(value);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () => []);
  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function isCloseEnough(input, validNames) {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return false;

  for (const name of validNames) {
    const normalizedName = normalizeText(name);

    if (normalizedInput === normalizedName) return true;

    const distance = levenshtein(normalizedInput, normalizedName);
    const maxLen = Math.max(normalizedInput.length, normalizedName.length);

    if (maxLen <= 5 && distance <= 1) return true;
    if (maxLen <= 10 && distance <= 2) return true;
    if (maxLen > 10 && distance <= 3) return true;
  }

  return false;
}

function getAccuracyClass(acc) {
  if (acc >= 80) return "good";
  if (acc >= 50) return "mid";
  return "bad";
}

function saveAttemptRecord(recordKey, summary, payload) {
  const storage = getStorageData();

  const record = {
    key: recordKey,
    summary,
    date: getTodayString(),
    details: payload
  };

  if (!storage.firstAttempts[recordKey]) {
    storage.firstAttempts[recordKey] = record;
  }

  storage.lastResults[recordKey] = record;
  saveStorageData(storage);
}

function getAttemptRecord(recordKey) {
  const storage = getStorageData();
  return {
    first: storage.firstAttempts[recordKey] || null,
    last: storage.lastResults[recordKey] || null
  };
}

function toggleModule(moduleId) {
  const content = document.getElementById(moduleId);
  const icon = document.getElementById(moduleId + "-icon");

  if (!content || !icon) return;

  const isOpen = content.classList.contains("open");

  document.querySelectorAll(".module-content").forEach(el => el.classList.remove("open"));
  document.querySelectorAll(".module-toggle-icon").forEach(el => el.textContent = "+");

  if (!isOpen) {
    content.classList.add("open");
    icon.textContent = "−";
  }
}

function renderHomeStats() {
  const storage = getStorageData();

  const general1 = storage.lastResults["general-1"];
  const estimate1 = storage.lastResults["estimate-1"];
  const flags = storage.lastResults["flags"];

  const general1El = document.getElementById("general-1-result");
  const estimate1El = document.getElementById("estimate-1-result");
  const flagsEl = document.getElementById("flags-result");
  const generalTotalEl = document.getElementById("general-total-result");
  const estimateTotalEl = document.getElementById("estimate-total-result");
  const flagsTotalEl = document.getElementById("flags-total-result");

  if (general1El) general1El.textContent = general1 ? general1.summary : "Noch nicht gespielt";
  if (estimate1El) estimate1El.textContent = estimate1 ? estimate1.summary : "Noch nicht gespielt";
  if (flagsEl) flagsEl.textContent = flags ? flags.summary : "Noch nicht gespielt";

  if (generalTotalEl) {
    const generalKeys = Object.keys(storage.lastResults).filter(k => k.startsWith("general-"));
    if (!generalKeys.length) {
      generalTotalEl.textContent = "Noch keine Daten";
    } else {
      let totalScore = 0;
      let totalQuestions = 0;

      generalKeys.forEach(key => {
        const details = storage.lastResults[key].details;
        if (details) {
          totalScore += details.score || 0;
          totalQuestions += details.total || 0;
        }
      });

      const percent = totalQuestions ? (totalScore / totalQuestions) * 100 : 0;
      generalTotalEl.textContent = `${totalScore}/${totalQuestions} (${formatNumber(percent)} %)`;
    }
  }

  if (estimateTotalEl) {
    const estimateKeys = Object.keys(storage.lastResults).filter(k => k.startsWith("estimate-"));
    if (!estimateKeys.length) {
      estimateTotalEl.textContent = "Noch keine Daten";
    } else {
      let totalPercent = 0;
      estimateKeys.forEach(key => {
        const details = storage.lastResults[key].details;
        totalPercent += details.percent || 0;
      });

      const avg = totalPercent / estimateKeys.length;
      estimateTotalEl.textContent = `${formatNumber(avg)} %`;
    }
  }

  if (flagsTotalEl) {
    const flagsKeys = Object.keys(storage.lastResults).filter(k => k.startsWith("flags"));
    if (!flagsKeys.length) {
      flagsTotalEl.textContent = "Noch keine Daten";
    } else {
      let totalScore = 0;
      let totalQuestions = 0;

      flagsKeys.forEach(key => {
        const details = storage.lastResults[key].details;
        if (details) {
          totalScore += details.score || 0;
          totalQuestions += details.total || 0;
        }
      });

      const percent = totalQuestions ? (totalScore / totalQuestions) * 100 : 0;
      flagsTotalEl.textContent = `${totalScore}/${totalQuestions} (${formatNumber(percent)} %)`;
    }
  }
}

function createQuizState(config) {
  return {
    config,
    currentQuestionIndex: 0,
    answers: new Array(config.questions.length).fill(null),
    timer: null,
    timeLeft: config.timePerQuestion || 20
  };
}

function renderMiniMap(state) {
  const miniMap = document.getElementById("miniMap");
  if (!miniMap) return;

  miniMap.innerHTML = "";
  state.config.questions.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.className = "mini-dot";
    dot.textContent = index + 1;

    const answer = state.answers[index];
    if (answer !== null && answer !== "" && answer !== undefined) {
      dot.classList.add("answered");
    }
    if (index === state.currentQuestionIndex) {
      dot.classList.add("current");
    }

    miniMap.appendChild(dot);
  });
}

function updateQuizHeader(state) {
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  const modeText = document.getElementById("modeText");
  const answeredText = document.getElementById("answeredText");
  const questionTypeText = document.getElementById("questionTypeText");
  const extraModeInfo = document.getElementById("extraModeInfo");

  const current = state.currentQuestionIndex + 1;
  const total = state.config.questions.length;

  progressText.textContent = `Frage ${current} von ${total}`;
  progressFill.style.width = `${(current / total) * 100}%`;
  modeText.textContent = state.config.modeLabel;
  answeredText.textContent = `Beantwortet: ${state.answers.filter(a => a !== null && a !== "" && a !== undefined).length}`;
  questionTypeText.textContent = state.config.questionType || "Quiz";
  extraModeInfo.textContent = state.config.extraInfo || "Standard";
}

function resetTimer(state) {
  const timerBox = document.getElementById("timerBox");
  clearInterval(state.timer);
  state.timeLeft = state.config.timePerQuestion || 20;
  timerBox.textContent = `${state.timeLeft}s`;
  timerBox.style.color = "white";

  state.timer = setInterval(() => {
    state.timeLeft--;
    timerBox.textContent = `${state.timeLeft}s`;

    if (state.timeLeft <= 5) {
      timerBox.style.color = "#fecaca";
    } else {
      timerBox.style.color = "white";
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      autoAdvance(state);
    }
  }, 1000);
}

function renderQuestion(state) {
  const q = state.config.questions[state.currentQuestionIndex];
  const questionNumber = document.getElementById("questionNumber");
  const questionTitle = document.getElementById("questionTitle");
  const questionHelp = document.getElementById("questionHelp");
  const dynamicAnswerArea = document.getElementById("dynamicAnswerArea");

  questionNumber.textContent = `Frage ${state.currentQuestionIndex + 1}`;
  questionTitle.textContent = q.question;
  questionHelp.textContent = state.config.helpText || "";

  if (state.config.type === "general") {
    dynamicAnswerArea.innerHTML = `
      <div class="options">
        ${q.options.map((option, index) => `
          <div class="option" data-index="${index}">${option}</div>
        `).join("")}
      </div>
    `;

    const selectedSaved = state.answers[state.currentQuestionIndex];
    const options = dynamicAnswerArea.querySelectorAll(".option");

    options.forEach(option => {
      if (selectedSaved !== null && Number(option.dataset.index) === Number(selectedSaved)) {
        option.classList.add("selected");
      }

      option.addEventListener("click", () => {
        options.forEach(o => o.classList.remove("selected"));
        option.classList.add("selected");
      });
    });
  }

  if (state.config.type === "estimate") {
    const savedValue = state.answers[state.currentQuestionIndex] ?? "";
    dynamicAnswerArea.innerHTML = `
      <div class="estimate-row">
        <div style="flex:1;min-width:220px;">
          <input
            id="estimateInput"
            class="estimate-input"
            type="text"
            inputmode="decimal"
            placeholder="Deine Schätzung"
            value="${String(savedValue).replace(/"/g, "&quot;")}"
          />
        </div>
        <div class="unit-pill">${q.unit}</div>
      </div>
    `;

    const input = document.getElementById("estimateInput");
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        nextQuestion(state);
      }
    });
  }

  if (state.config.type === "flags") {
    const savedValue = state.answers[state.currentQuestionIndex] ?? "";
    dynamicAnswerArea.innerHTML = `
      <div class="flag-card">
        <img class="flag-preview" src="${q.flag}" alt="Flagge von ${q.countryDe}" onerror="this.alt='Flagge nicht gefunden';this.style.opacity='0.35';">
        <div class="flag-input-row">
          <div class="autocomplete-wrap">
            <input
              id="flagInput"
              class="flag-input"
              type="text"
              autocomplete="off"
              placeholder="Land eingeben"
              value="${String(savedValue).replace(/"/g, "&quot;")}"
            >
            <div class="suggestions" id="flagSuggestions"></div>
          </div>
          <div id="flagFeedback" class="live-feedback"></div>
        </div>
      </div>
    `;

    const input = document.getElementById("flagInput");
    const suggestionsEl = document.getElementById("flagSuggestions");

    input.addEventListener("input", () => {
      renderFlagSuggestions(state, input.value);
      evaluateFlagLive(state);
    });

    input.addEventListener("focus", () => {
      if (input.value.trim()) renderFlagSuggestions(state, input.value);
      evaluateFlagLive(state);
    });

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        suggestionsEl.classList.remove("show");
        nextQuestion(state);
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => suggestionsEl.classList.remove("show"), 120);
    });

    evaluateFlagLive(state);
  }

  updateQuizHeader(state);
  renderMiniMap(state);
  resetTimer(state);
}

function saveCurrentAnswer(state) {
  if (state.config.type === "general") {
    const selected = document.querySelector(".option.selected");
    state.answers[state.currentQuestionIndex] = selected ? Number(selected.dataset.index) : null;
  }

  if (state.config.type === "estimate") {
    const input = document.getElementById("estimateInput");
    state.answers[state.currentQuestionIndex] = input ? input.value.trim() : "";
  }

  if (state.config.type === "flags") {
    const input = document.getElementById("flagInput");
    state.answers[state.currentQuestionIndex] = input ? input.value.trim() : "";
  }
}

function autoAdvance(state) {
  saveCurrentAnswer(state);
  if (state.currentQuestionIndex < state.config.questions.length - 1) {
    state.currentQuestionIndex++;
    renderQuestion(state);
  } else {
    finishQuiz(state);
  }
}

function nextQuestion(state) {
  saveCurrentAnswer(state);
  if (state.currentQuestionIndex < state.config.questions.length - 1) {
    state.currentQuestionIndex++;
    renderQuestion(state);
  } else {
    finishQuiz(state);
  }
}

function skipQuestion(state) {
  state.answers[state.currentQuestionIndex] = state.config.type === "general" ? null : "";
  if (state.currentQuestionIndex < state.config.questions.length - 1) {
    state.currentQuestionIndex++;
    renderQuestion(state);
  } else {
    finishQuiz(state);
  }
}

function renderFlagSuggestions(state, query) {
  const suggestionsEl = document.getElementById("flagSuggestions");
  if (!suggestionsEl) return;

  const names = state.config.flagNames || [];
  const normQuery = normalizeText(query);

  if (!query.trim()) {
    suggestionsEl.innerHTML = "";
    suggestionsEl.classList.remove("show");
    return;
  }

  const matches = names.filter(name => normalizeText(name).startsWith(normQuery));

  if (!matches.length) {
    suggestionsEl.innerHTML = `<div class="suggestion-empty">Kein Land gefunden</div>`;
    suggestionsEl.classList.add("show");
    return;
  }

  suggestionsEl.innerHTML = matches.map(name => `
    <div class="suggestion-item" data-name="${name.replace(/"/g, "&quot;")}">${name}</div>
  `).join("");

  suggestionsEl.classList.add("show");

  suggestionsEl.querySelectorAll(".suggestion-item").forEach(item => {
    item.addEventListener("click", () => {
      const input = document.getElementById("flagInput");
      input.value = item.dataset.name;
      suggestionsEl.classList.remove("show");
      evaluateFlagLive(state);
      input.focus();
    });
  });
}

function evaluateFlagLive(state) {
  if (state.config.type !== "flags") return;

  const input = document.getElementById("flagInput");
  const feedback = document.getElementById("flagFeedback");
  if (!input || !feedback) return;

  const q = state.config.questions[state.currentQuestionIndex];
  const value = input.value.trim();

  if (!value) {
    feedback.className = "live-feedback";
    feedback.textContent = "";
    return;
  }

  const isCorrect = isCloseEnough(value, q.aliases);
  feedback.className = "live-feedback show " + (isCorrect ? "correct" : "incorrect");
  feedback.textContent = isCorrect
    ? `Richtig erkannt: ${q.countryDe} / ${q.countryEn}`
    : "Noch nicht passend";
}

function finishQuiz(state) {
  saveCurrentAnswer(state);
  clearInterval(state.timer);

  let payload;

  if (state.config.type === "general") {
    const results = state.config.questions.map((q, index) => {
      const userAnswer = state.answers[index];
      const answered = userAnswer !== null && userAnswer !== undefined;
      const correct = answered && Number(userAnswer) === Number(q.answer);

      return {
        question: q.question,
        answered,
        correct,
        userValue: answered ? q.options[userAnswer] : "Keine Eingabe",
        correctValue: q.options[q.answer]
      };
    });

    const score = results.filter(r => r.correct).length;
    const answered = results.filter(r => r.answered).length;
    const percent = results.length ? (score / results.length) * 100 : 0;

    payload = { type: "general", results, score, answered, total: results.length, percent };
  }

  if (state.config.type === "estimate") {
    const results = state.config.questions.map((q, index) => {
      const raw = state.answers[index];
      const parsed = parseGermanNumber(raw);

      if (!isNaN(parsed) && parsed >= 0) {
        let deviationPercent;
        if (q.answer === 0) {
          deviationPercent = parsed === 0 ? 0 : 100;
        } else {
          deviationPercent = Math.abs(parsed - q.answer) / Math.abs(q.answer) * 100;
        }

        const accuracy = Math.max(0, 100 - deviationPercent);

        return {
          question: q.question,
          answered: true,
          userValue: parsed,
          correctValue: q.answer,
          unit: q.unit,
          deviationPercent,
          accuracy
        };
      }

      return {
        question: q.question,
        answered: false,
        userValue: null,
        correctValue: q.answer,
        unit: q.unit,
        deviationPercent: null,
        accuracy: 0
      };
    });

    const answered = results.filter(r => r.answered).length;
    const avgAccuracy = results.length
      ? results.reduce((sum, r) => sum + r.accuracy, 0) / results.length
      : 0;

    payload = { type: "estimate", results, answered, total: results.length, percent: avgAccuracy };
  }

  if (state.config.type === "flags") {
    const results = state.config.questions.map((q, index) => {
      const raw = state.answers[index] ?? "";
      const userValue = String(raw).trim();
      const answered = userValue !== "";
      const correct = answered && isCloseEnough(userValue, q.aliases);

      return {
        question: q.question,
        answered,
        correct,
        userValue: answered ? userValue : "Keine Eingabe",
        correctValue: `${q.countryDe} / ${q.countryEn}`,
        flag: q.flag
      };
    });

    const score = results.filter(r => r.correct).length;
    const answered = results.filter(r => r.answered).length;
    const percent = results.length ? (score / results.length) * 100 : 0;

    payload = { type: "flags", results, score, answered, total: results.length, percent };
  }

  const summary = state.config.type === "estimate"
    ? `${formatNumber(payload.percent)} % Genauigkeit`
    : `${payload.score}/${payload.total} (${formatNumber(payload.percent)} %)`;

  saveAttemptRecord(state.config.recordKey, summary, payload);
  renderResults(state, payload);
}

function renderResults(state, payload) {
  const resultScreen = document.getElementById("resultScreen");
  const quizScreen = document.getElementById("quizScreen");
  const record = getAttemptRecord(state.config.recordKey);

  const isGeneral = payload.type === "general";
  const isEstimate = payload.type === "estimate";
  const isFlags = payload.type === "flags";

  const mainScore = isEstimate
    ? `${formatNumber(payload.percent)} %`
    : `${payload.score} / ${payload.total}`;

  const accuracyText = isEstimate
    ? `Ø ${formatNumber(payload.percent)} % Genauigkeit`
    : `${formatNumber(payload.percent)} % Trefferquote`;

  let bestStat = "";
  let noteText = "";

  if (isGeneral) {
    bestStat = `${payload.score} richtig`;
    noteText = "Jede richtige Antwort zählt als ein Punkt.";
  } else if (isEstimate) {
    const best = Math.max(...payload.results.map(r => r.accuracy));
    bestStat = `${formatNumber(best)} % beste Antwort`;
    noteText = "Die Genauigkeit wird pro Frage prozentual bewertet.";
  } else {
    bestStat = `${payload.score} Flaggen erkannt`;
    noteText = "Deutsch und Englisch wurden akzeptiert. Kleine Tippfehler wurden toleriert.";
  }

  resultScreen.innerHTML = `
    <div class="screen active">
      <div class="result-hero">
        <div class="pill-note">Erster Versuch bleibt gespeichert</div>
        <h2>${state.config.modeLabel} Ergebnis</h2>
        <p class="muted">Premium Auswertung</p>
      </div>

      <div class="dashboard-grid">
        <div class="score-hero">
          <div class="score-main">
            <div class="score-value">${mainScore}</div>
            <div class="score-sub">${accuracyText}</div>
          </div>
          <div class="record-note">${noteText}</div>
        </div>

        <div class="dashboard-side">
          <div class="score-card">
            <div class="title">Erster Versuch</div>
            <div class="value">${record.first ? record.first.summary : "Gerade gespeichert"}</div>
            <div class="record-note">${record.first ? record.first.date : ""}</div>
          </div>

          <div class="score-card">
            <div class="title">Beantwortet</div>
            <div class="value">${payload.answered} / ${payload.total}</div>
            <div class="record-note">Alle Fragen bleiben sichtbar.</div>
          </div>
        </div>
      </div>

      <div class="scoreboard">
        <div class="scoreboard-item">
          <div class="k">Modul</div>
          <div class="v">${state.config.modeLabel}</div>
        </div>
        <div class="scoreboard-item">
          <div class="k">Leistung</div>
          <div class="v">${accuracyText}</div>
        </div>
        <div class="scoreboard-item">
          <div class="k">Top-Wert</div>
          <div class="v">${bestStat}</div>
        </div>
        <div class="scoreboard-item">
          <div class="k">Quiz</div>
          <div class="v">${state.config.recordKey}</div>
        </div>
      </div>

      <div class="results-list">
        ${isGeneral ? renderGeneralResultItems(payload.results) : ""}
        ${isEstimate ? renderEstimateResultItems(payload.results) : ""}
        ${isFlags ? renderFlagResultItems(payload.results) : ""}
      </div>

      <div class="footer-actions">
        <a class="btn-secondary" href="index.html">Zum Start</a>
        <button class="btn-primary" onclick="location.reload()">Nochmal spielen</button>
      </div>
    </div>
  `;

  quizScreen.style.display = "none";
  resultScreen.style.display = "block";
}

function renderGeneralResultItems(results) {
  return results.map((r, index) => `
    <div class="result-item">
      <h3>${index + 1}. ${r.question}</h3>
      <div class="result-meta">Allgemeinwissen</div>
      <div class="result-grid">
        <div class="metric">
          <div class="k">Deine Antwort</div>
          <div class="v">${r.userValue}</div>
        </div>
        <div class="metric">
          <div class="k">Richtige Antwort</div>
          <div class="v">${r.correctValue}</div>
        </div>
        <div class="metric">
          <div class="k">Status</div>
          <div class="v ${r.correct ? "good" : "bad"}">${r.answered ? (r.correct ? "Richtig" : "Falsch") : "Keine Eingabe"}</div>
        </div>
        <div class="metric">
          <div class="k">Punkt</div>
          <div class="v">${r.correct ? "1" : "0"}</div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderEstimateResultItems(results) {
  return results.map((r, index) => `
    <div class="result-item">
      <h3>${index + 1}. ${r.question}</h3>
      <div class="result-meta">Schätzfrage</div>
      <div class="result-grid">
        <div class="metric">
          <div class="k">Deine Eingabe</div>
          <div class="v">${r.answered ? formatNumber(r.userValue) + " " + r.unit : "Keine Eingabe"}</div>
        </div>
        <div class="metric">
          <div class="k">Richtige Antwort</div>
          <div class="v">${formatNumber(r.correctValue)} ${r.unit}</div>
        </div>
        <div class="metric">
          <div class="k">Abweichung</div>
          <div class="v">${r.deviationPercent !== null ? formatNumber(r.deviationPercent) + " %" : "-"}</div>
        </div>
        <div class="metric">
          <div class="k">Trefferquote</div>
          <div class="v ${getAccuracyClass(r.accuracy)}">${formatNumber(r.accuracy)} %</div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderFlagResultItems(results) {
  return results.map((r, index) => `
    <div class="result-item">
      <h3>${index + 1}. ${r.question}</h3>
      <div class="result-meta">Flaggenquiz</div>
      <div class="result-grid">
        <div class="metric">
          <div class="k">Flagge</div>
          <div class="v"><img src="${r.flag}" alt="${r.correctValue}" style="width:72px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);vertical-align:middle;"></div>
        </div>
        <div class="metric">
          <div class="k">Deine Antwort</div>
          <div class="v">${r.userValue}</div>
        </div>
        <div class="metric">
          <div class="k">Richtige Antwort</div>
          <div class="v">${r.correctValue}</div>
        </div>
        <div class="metric">
          <div class="k">Status</div>
          <div class="v ${r.correct ? "good" : "bad"}">${r.answered ? (r.correct ? "Richtig" : "Falsch") : "Keine Eingabe"}</div>
        </div>
      </div>
    </div>
  `).join("");
}