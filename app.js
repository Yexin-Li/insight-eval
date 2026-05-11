// Blind Evaluation App - Main Logic

let currentQuestionIdx = 0;
let currentAnswerLabel = 'A';  // which answer tab is active
let scores = {}; // { questionId: { A: {G2: score, G4: score, G5: score, rationale: ""}, B: {...}, C: {...} } }

// Load saved scores from localStorage
function loadScores() {
  const saved = localStorage.getItem('eval_scores_' + EVAL_DATA.language);
  if (saved) {
    scores = JSON.parse(saved);
  }
}

// Save scores to localStorage
function persistScores() {
  localStorage.setItem('eval_scores_' + EVAL_DATA.language, JSON.stringify(scores));
}

// Calculate sticky top offset for scoring panel based on actual header heights
function updateScoringTop() {
  const header = document.querySelector('.header');
  const questionBar = document.querySelector('.question-bar');
  const top = (header?.offsetHeight || 0) + (questionBar?.offsetHeight || 0) + 8;
  document.documentElement.style.setProperty('--scoring-top', top + 'px');
}

// Initialize the app
function init() {
  loadScores();
  populateQuestionSelect();
  renderQuestion(0);
  updateProgress();
  updateScoringTop();
  window.addEventListener('resize', updateScoringTop);
  
  // Language select
  const langSelect = document.getElementById('lang-select');
  if (langSelect) langSelect.value = EVAL_DATA.language;

  // Localize the Scoring Rubric button label
  const rubricBtn = document.getElementById('btn-rubric');
  if (rubricBtn) {
    rubricBtn.textContent = EVAL_DATA.language === 'en'
      ? '📋 Scoring Rubric'
      : '📋 评分标准参考';
  }
  
  // Load reviewer name
  const savedName = localStorage.getItem('eval_reviewer_name');
  if (savedName) {
    document.getElementById('reviewer-name').value = savedName;
  }
  
  document.getElementById('reviewer-name').addEventListener('change', (e) => {
    localStorage.setItem('eval_reviewer_name', e.target.value);
  });
  
  // Keyboard shortcuts: 1-5 to switch tabs; Alt+Left/Right to navigate questions
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in a text field
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    
    // Close modal with Escape
    if (e.key === 'Escape') {
      const modal = document.getElementById('guide-modal');
      if (modal && !modal.classList.contains('hidden')) {
        closeGuide();
        return;
      }
    }
    
    if (e.key >= '1' && e.key <= '6') {
      const q = EVAL_DATA.questions[currentQuestionIdx];
      const idx = parseInt(e.key) - 1;
      if (idx < q.answers.length) {
        activateAnswer(q.answers[idx].label);
        e.preventDefault();
      }
    } else if (e.altKey && e.key === 'ArrowLeft') {
      navigate(-1);
      e.preventDefault();
    } else if (e.altKey && e.key === 'ArrowRight') {
      navigate(1);
      e.preventDefault();
    }
  });
  
  // Show rater guide on first visit
  maybeAutoShowGuide();
}

// Populate question dropdown
function populateQuestionSelect() {
  const select = document.getElementById('question-select');
  const langKey = EVAL_DATA.language === 'zh' ? 'question_zh' : 'question_en';
  EVAL_DATA.questions.forEach((q, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    const scored = isQuestionScored(q) ? ' ✓' : '';
    const qText = q.text || q[langKey] || '';
    opt.textContent = `${q.id}${scored} — ${qText.substring(0, 40)}...`;
    select.appendChild(opt);
  });
  select.addEventListener('change', (e) => {
    currentQuestionIdx = parseInt(e.target.value);
    renderQuestion(currentQuestionIdx);
  });
}

// Check if a question has any scores
function isQuestionScored(q) {
  if (!scores[q.id]) return false;
  return q.answers.some(ans => 
    q.graders.some(g => {
      const v = scores[q.id]?.[ans.label]?.[g];
      return v !== '' && v !== undefined && v !== null;
    })
  );
}

// Navigate to previous/next question
function navigate(delta) {
  const newIdx = currentQuestionIdx + delta;
  if (newIdx < 0 || newIdx >= EVAL_DATA.questions.length) return;
  currentQuestionIdx = newIdx;
  document.getElementById('question-select').value = newIdx;
  renderQuestion(newIdx);
}

// Update prev/next button state
function updateNavButtons() {
  document.getElementById('btn-prev').disabled = currentQuestionIdx === 0;
  document.getElementById('btn-next').disabled = currentQuestionIdx === EVAL_DATA.questions.length - 1;
}

// Render a question
function renderQuestion(idx) {
  const q = EVAL_DATA.questions[idx];
  
  // Reset active tab to the first answer
  currentAnswerLabel = q.answers[0].label;
  
  // Question text
  const langKey = EVAL_DATA.language === 'zh' ? 'question_zh' : 'question_en';
  document.getElementById('question-text').textContent = `[${q.id}] ${q.text || q[langKey] || ''}`;
  const profileEl = document.getElementById('question-profile');
  if (profileEl) profileEl.textContent = q.profile_name || '';
  const accountEl = document.getElementById('question-account');
  if (accountEl) accountEl.textContent = q.main_account || '';
  
  // Grader tags
  const tagsEl = document.getElementById('grader-tags');
  tagsEl.innerHTML = '';
  ['G2', 'G4', 'G5'].forEach(g => {
    const tag = document.createElement('span');
    tag.className = 'grader-tag' + (q.graders.includes(g) ? '' : ' inactive');
    tag.textContent = g;
    tagsEl.appendChild(tag);
  });
  
  // Render answer tabs + cards
  renderAnswerTabs(q);
  renderAnswerCards(q);
  activateAnswer(currentAnswerLabel);
  
  // Update nav buttons
  updateNavButtons();
  
  // Keep select in sync
  document.getElementById('question-select').value = idx;
  
  // Scroll page back to top
  window.scrollTo(0, 0);
}

// Render the tab bar
function renderAnswerTabs(q) {
  const bar = document.getElementById('answer-tabs');
  bar.innerHTML = '';
  q.answers.forEach(ans => {
    const btn = document.createElement('button');
    const hasScore = q.graders.some(g => {
      const v = scores[q.id]?.[ans.label]?.[g];
      return v !== '' && v !== undefined && v !== null;
    });
    // If label is a short anonymous letter (A/B/C/...), prefix with "Answer ".
    // If it's a model name (longer), show it as-is.
    const labelText = ans.label.length <= 2 ? `Answer ${ans.label}` : ans.label;
    btn.innerHTML = `${labelText}${hasScore ? '<span class="scored-dot"></span>' : ''}`;
    btn.onclick = () => activateAnswer(ans.label);
    btn.dataset.label = ans.label;
    bar.appendChild(btn);
  });
}

// Activate a specific answer tab
function activateAnswer(label) {
  currentAnswerLabel = label;
  
  // Update tab buttons
  document.querySelectorAll('#answer-tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.label === label);
  });
  
  // Update visible card
  document.querySelectorAll('.answer-card').forEach(card => {
    card.classList.toggle('active', card.id === `card-${label}`);
  });
}

// Render answer cards (answer content + inline scoring form, side-by-side)
function renderAnswerCards(q) {
  const stack = document.getElementById('answers-stack');
  stack.innerHTML = '';
  
  q.answers.forEach(ans => {
    const card = document.createElement('article');
    card.className = 'answer-card';
    card.id = `card-${ans.label}`;
    
    // Body: left = answer content, right = scoring form
    // (No separate header — the tab already identifies the active answer)
    const body = document.createElement('div');
    body.className = 'answer-card-body';
    
    const answerBody = document.createElement('div');
    answerBody.className = 'answer-body';
    answerBody.innerHTML = marked.parse(ans.content);
    body.appendChild(answerBody);
    
    const scoring = document.createElement('div');
    scoring.className = 'answer-scoring';
    scoring.innerHTML = buildScoringFormHTML(q, ans);
    body.appendChild(scoring);
    
    card.appendChild(body);
    stack.appendChild(card);
  });
}

// Build the scoring form HTML for a single answer
function buildScoringFormHTML(q, ans) {
  const saved = scores[q.id]?.[ans.label] || {};
  const graders = q.graders;
  const isEn = EVAL_DATA.language === 'en';
  
  // Localized labels
  const L = isEn ? {
    selectScore: 'Select score',
    na: 'N/A — Not applicable',
    confidence: 'Confidence',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    rationale: 'Rationale',
    ratHint: '1-2 sentences of evidence for your scores',
  } : {
    selectScore: '请选择分数',
    na: 'N/A — 本题不适用',
    confidence: 'Confidence 置信度',
    high: '高 / High',
    medium: '中 / Medium',
    low: '低 / Low',
    rationale: 'Rationale 打分理由',
    ratHint: '1-2 句证据说明',
  };
  
  let html = '';
  
  // Each grader: dropdown + optional description on hover
  graders.forEach(grader => {
    const savedScore = saved[grader] ?? '';
    const rubric = EVAL_DATA.rubric[grader];
    html += `
      <div class="scoring-row">
        <div class="score-group">
          <label class="label-with-hint">
            ${grader} — ${rubric.name}
            <span class="hint-icon" title="${rubric.description}">?</span>
          </label>
          <select id="score_${q.id}_${ans.label}_${grader}" onchange="onScoreChange()">
            <option value="">${L.selectScore}</option>
            ${[1,2,3,4,5].map(n => `<option value="${n}" ${savedScore === n ? 'selected' : ''}>${n} — ${rubric.scores[String(n)]}</option>`).join('')}
            <option value="N/A" ${savedScore === 'N/A' ? 'selected' : ''}>${L.na}</option>
          </select>
        </div>
      </div>
    `;
  });
  
  // Confidence (simple, optional)
  const savedConf = saved.confidence || '';
  html += `
    <div class="scoring-row">
      <div class="score-group">
        <label>${L.confidence}</label>
        <select id="confidence_${q.id}_${ans.label}" onchange="onScoreChange()">
          <option value="" ${!savedConf ? 'selected' : ''}>—</option>
          <option value="high" ${savedConf === 'high' ? 'selected' : ''}>${L.high}</option>
          <option value="medium" ${savedConf === 'medium' ? 'selected' : ''}>${L.medium}</option>
          <option value="low" ${savedConf === 'low' ? 'selected' : ''}>${L.low}</option>
        </select>
      </div>
    </div>
  `;
  
  // Rationale textarea (takes up remaining space)
  const savedRat = saved.rationale || '';
  html += `
    <div class="scoring-row">
      <div class="score-group">
        <label>${L.rationale}</label>
        <textarea id="rationale_${q.id}_${ans.label}" placeholder="${L.ratHint}" oninput="onScoreChange()">${savedRat}</textarea>
      </div>
    </div>
  `;
  
  return html;
}

// Render the scoring form — legacy function no longer used (scoring is inline per answer card now)
function renderScoringGrid(q) {
  // no-op
}

// Auto-save on any score change
function onScoreChange() {
  saveScores();
}

// Save current question's scores
function saveScores() {
  const q = EVAL_DATA.questions[currentQuestionIdx];
  
  if (!scores[q.id]) {
    scores[q.id] = {};
  }
  
  q.answers.forEach(ans => {
    if (!scores[q.id][ans.label]) {
      scores[q.id][ans.label] = {};
    }
    
    // Save grader scores
    q.graders.forEach(grader => {
      const el = document.getElementById(`score_${q.id}_${ans.label}_${grader}`);
      if (el) {
        const val = el.value;
        scores[q.id][ans.label][grader] = val === '' ? '' : (val === 'N/A' ? 'N/A' : parseInt(val));
      }
    });
    
    // Save rationale
    const ratEl = document.getElementById(`rationale_${q.id}_${ans.label}`);
    if (ratEl) {
      scores[q.id][ans.label].rationale = ratEl.value;
    }
    
    // Save confidence
    const confEl = document.getElementById(`confidence_${q.id}_${ans.label}`);
    if (confEl) {
      scores[q.id][ans.label].confidence = confEl.value;
    }
  });
  
  persistScores();
  updateProgress();
  updateJumpBarScored();
  showAutosaveIndicator();
}

// Flash the autosave indicator briefly
function showAutosaveIndicator() {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  el.classList.add('visible');
  clearTimeout(window._autosaveTimer);
  window._autosaveTimer = setTimeout(() => el.classList.remove('visible'), 1500);
}

// Update scored dot on answer tabs after score change
function updateJumpBarScored() {
  const q = EVAL_DATA.questions[currentQuestionIdx];
  const bar = document.getElementById('answer-tabs');
  const btns = bar.querySelectorAll('button');
  q.answers.forEach((ans, i) => {
    const btn = btns[i];
    if (!btn) return;
    const hasScore = q.graders.some(g => {
      const v = scores[q.id]?.[ans.label]?.[g];
      return v !== '' && v !== undefined && v !== null;
    });
    // Rebuild inner HTML (preserving active state via class)
    const labelText = ans.label.length <= 2 ? `Answer ${ans.label}` : ans.label;
    btn.innerHTML = `${labelText}${hasScore ? '<span class="scored-dot"></span>' : ''}`;
  });
}

// Update progress badge
function updateProgress() {
  const total = EVAL_DATA.questions.length;
  let scored = 0;
  EVAL_DATA.questions.forEach(q => {
    if (isQuestionScored(q)) scored++;
  });
  document.getElementById('progress-badge').textContent = `${scored} / ${total} scored`;
  
  // Update select options with checkmarks
  const select = document.getElementById('question-select');
  const langKey = EVAL_DATA.language === 'zh' ? 'question_zh' : 'question_en';
  EVAL_DATA.questions.forEach((q, idx) => {
    const mark = isQuestionScored(q) ? ' ✓' : '';
    select.options[idx].textContent = `${q.id}${mark} — ${(q.text || q[langKey] || '').substring(0, 40)}...`;
  });
}

// Toggle rubric panel
function toggleRubric() {
  const panel = document.getElementById('rubric-panel');
  panel.classList.toggle('hidden');
  
  if (!panel.classList.contains('hidden')) {
    renderRubric();
  }
}

// Render rubric content
function renderRubric() {
  const content = document.getElementById('rubric-content');
  const isEn = EVAL_DATA.language === 'en';
  const scoreLabel = isEn ? 'Score' : '分数';
  const criteriaLabel = isEn ? 'Criteria' : '判定标准';
  let html = '';
  
  Object.entries(EVAL_DATA.rubric).forEach(([key, rubric]) => {
    html += `<h3>${key}: ${rubric.name}</h3>`;
    html += `<p><em>${rubric.description}</em></p>`;
    html += `<table><tr><th>${scoreLabel}</th><th>${criteriaLabel}</th></tr>`;
    Object.entries(rubric.scores).forEach(([score, desc]) => {
      html += `<tr><td><strong>${score}</strong></td><td>${desc}</td></tr>`;
    });
    html += '</table>';
  });
  
  content.innerHTML = html;
}

// Export results as JSON
function exportResults() {
  const reviewer = document.getElementById('reviewer-name').value || 'anonymous';
  const exportData = {
    reviewer: reviewer,
    language: EVAL_DATA.language,
    exported_at: new Date().toISOString(),
    scores: scores
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eval_scores_${EVAL_DATA.language}_${reviewer}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Export results as CSV
function exportCSV() {
  const reviewer = document.getElementById('reviewer-name').value || 'anonymous';
  
  let rows = [['case_id', 'answer_label', 'G2_score', 'G4_score', 'G5_score', 'rationale', 'confidence', 'reviewer', 'language']];
  
  EVAL_DATA.questions.forEach(q => {
    q.answers.forEach(ans => {
      const s = scores[q.id]?.[ans.label] || {};
      rows.push([
        q.id,
        ans.label,
        s.G2 ?? '',
        s.G4 ?? '',
        s.G5 ?? '',
        `"${(s.rationale || '').replace(/"/g, '""')}"`,
        s.confidence || '',
        reviewer,
        EVAL_DATA.language
      ]);
    });
  });
  
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eval_scores_${EVAL_DATA.language}_${reviewer}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Toast notification
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1500);
}

// ===== Rater Guide Modal =====

const GUIDE_ZH = `
<h2>📖 评分员须知</h2>

<h3>你在做什么</h3>
<p>对不同 LLM 模型配合亚马逊 Ads MCP，和 Insight Agent 针对亚马逊广告问题生成的回答进行质量打分。你的评分用于构建亚马逊广告洞察的 benchmark，并对比 Insight Agent 与各 LLM 模型在回答质量上的表现。</p>

<h3>保存与提交</h3>
<p>📌 <strong>评分会自动保存，无需手动点保存。</strong>每次选分数或填写理由时，浏览器自动保存。顶部出现"<strong>✓</strong>"就是保存成功。关闭页面也不会丢分，下次打开同一浏览器仍然在。</p>
<p>✅ <strong>全部评完后</strong>：右上角点 <strong>⬇ CSV</strong> 按钮下载文件，发给评测负责人即可。无需其他操作。</p>

<h3>基本流程</h3>
<ol>
  <li>填写顶部的 <strong>Reviewer</strong> 姓名（会记住，之后不用再填）。</li>
  <li>从 <strong>Question</strong> 下拉菜单选题（已评分的题旁有 ✓）。</li>
  <li>阅读题目和每个 Tab 里的答案。Tab 之间可以来回切换对比。</li>
  <li>在每个答案右边给 <strong>G2 / G4 / G5</strong> 打分（1-5 分，或 N/A）。</li>
  <li>写 1-2 句 <strong>Rationale 打分理由</strong>，说明你为什么给这个分。</li>
  <li>全部评完后，右上角点 <strong>⬇ CSV</strong> 导出文件发给评测负责人。</li>
</ol>

<h3>评分维度</h3>
<ul>
  <li><strong>G2 分析 Scope</strong>：是否覆盖了回答这个问题所需的数据、事实、对象、时间窗、对比基线等。</li>
  <li><strong>G4 推理质量</strong>：推理/归因是否可信——证据是否支撑结论、是否考虑替代解释、是否符合业务常识。</li>
  <li><strong>G5 建议质量</strong>：如果题目要求建议，这份建议是否<strong>应该执行</strong>且<strong>能执行</strong>（对象明确、参数合理、有风险提示）。</li>
</ul>
<p>顶部的 <strong>📋 评分标准参考</strong> 按钮可以随时查看每个分数档的详细标准。鼠标悬停在 <kbd>?</kbd> 图标上可看维度简介。</p>

<h3>打分原则</h3>
<ul>
  <li><strong>先对再好</strong>：事实、口径、时间窗错了，不要因为文风好、建议漂亮就给高分。</li>
  <li><strong>只评显示的答案</strong>：不评价模型的思考过程或工具调用，只评最终回答。</li>
  <li><strong>N/A 使用规则</strong>：只在该维度确实不适用时用（如题目只要求列表不要求建议，G5 可以 N/A）。尝试了但做得不好，应该按 1-5 分扣分。</li>
  <li><strong>写一句证据</strong>：Rationale 写"感觉不错"没用。请指出具体哪里做得好/不好。</li>
</ul>

<h3>小技巧</h3>
<ul>
  <li>评分会<strong>自动保存</strong>到浏览器，不用手动点保存。看到顶部的"✓ Auto-saved"闪就是保存成功。</li>
  <li>键盘快捷键：<kbd>1</kbd>-<kbd>5</kbd> 快速切换 Tab；<kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> 上一题/下一题。</li>
  <li>建议把答案都读完再打分，不要一个答案一个答案单独评分（会有 anchoring 偏差）。</li>
  <li><strong>一个题目建议 5-8 分钟内完成</strong>；超过太久说明题目复杂，可以标低 Confidence 供后续复核。</li>
</ul>
`;

const GUIDE_EN = `
<h2>📖 Rater Guide</h2>

<h3>What you're doing</h3>
<p>You're rating the quality of answers generated by (a) different LLMs paired with the Amazon Ads MCP and (b) Insight Agent, on Amazon-ads analysis questions. Your scores help build a benchmark for Amazon-ads insight quality and compare Insight Agent against the LLM baselines.</p>

<h3>Saving & Submission</h3>
<p>📌 <strong>Scores save automatically — no submit button needed.</strong> Every time you select a score or type a rationale, the browser saves instantly. The "<strong>✓</strong>" badge in the header confirms the save. Closing the tab won't lose your work; reopen the same browser and everything is still there.</p>
<p>✅ <strong>When you're done</strong>: click <strong>⬇ CSV</strong> in the top right to download your scores, then send the file to the eval owner. That's it.</p>

<h3>Basic flow</h3>
<ol>
  <li>Enter your name in the <strong>Reviewer</strong> field (it's remembered next time).</li>
  <li>Pick a question from the <strong>Question</strong> dropdown (scored items show a ✓).</li>
  <li>Read the question and each answer in the tabs. Switch tabs freely to compare.</li>
  <li>For each answer, score <strong>G2 / G4 / G5</strong> on the right (1-5, or N/A).</li>
  <li>Write a 1-2 sentence <strong>Rationale</strong> explaining your score.</li>
  <li>When done, click <strong>⬇ CSV</strong> (top right) and send the file to the eval owner.</li>
</ol>

<h3>Grading dimensions</h3>
<ul>
  <li><strong>G2 Analysis Scope</strong>: Does the answer cover the data, facts, objects, time windows, and comparison baselines needed?</li>
  <li><strong>G4 Reasoning Quality</strong>: Is the reasoning/attribution credible — evidence supports the conclusion, alternatives considered, fits business common sense.</li>
  <li><strong>G5 Recommendation Quality</strong>: If the question asks for a recommendation, <strong>should</strong> it be executed and <strong>can</strong> it actually be executed (clear targets, sensible parameters, risk notes).</li>
</ul>
<p>Click <strong>📋 Scoring Rubric</strong> anytime for the full criteria per score. Hover the <kbd>?</kbd> icon for a short description of each dimension.</p>

<h3>Rating principles</h3>
<ul>
  <li><strong>Correct before polished</strong>: Wrong facts / wrong time window / wrong object — don't give a high score just because the writing is fluent.</li>
  <li><strong>Only judge the final answer</strong>, not the model's thought process or tool calls.</li>
  <li><strong>When to use N/A</strong>: only if the dimension genuinely doesn't apply (e.g., the question asks for a list only, no recommendation → G5 can be N/A). If the answer attempted but did poorly, give 1-2, not N/A.</li>
  <li><strong>Write evidence</strong>: "Looks good" is not useful. Point to something specific in the answer.</li>
</ul>

<h3>Tips</h3>
<ul>
  <li>Scores <strong>auto-save</strong> to your browser. The "✓ Auto-saved" badge flashes when it works.</li>
  <li>Keyboard shortcuts: <kbd>1</kbd>-<kbd>5</kbd> to switch tabs; <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> for prev/next question.</li>
  <li>Recommended: read all answers first, then score — scoring one at a time can cause anchoring bias.</li>
  <li><strong>5-8 minutes per question</strong> is a good target. If you're stuck longer, mark Confidence low for later review.</li>
</ul>
`;

// Open the rater guide modal
function openGuide() {
  const modal = document.getElementById('guide-modal');
  const content = document.getElementById('guide-content');
  const isEn = EVAL_DATA.language === 'en';
  // Show only the language-appropriate guide
  content.innerHTML = isEn ? GUIDE_EN : GUIDE_ZH;
  modal.classList.remove('hidden');
  
  // Pre-check "don't show again" based on saved pref
  const dontShow = localStorage.getItem('eval_guide_dismissed') === '1';
  document.getElementById('dont-show-guide').checked = dontShow;
}

function closeGuide() {
  document.getElementById('guide-modal').classList.add('hidden');
  // Save "don't show again" preference
  if (document.getElementById('dont-show-guide').checked) {
    localStorage.setItem('eval_guide_dismissed', '1');
  } else {
    localStorage.removeItem('eval_guide_dismissed');
  }
}

function closeGuideIfOverlay(event) {
  // Only close when clicking the overlay backdrop, not the modal content
  if (event.target.id === 'guide-modal') {
    closeGuide();
  }
}

// Show the guide automatically on first visit (unless user dismissed it)
function maybeAutoShowGuide() {
  const dismissed = localStorage.getItem('eval_guide_dismissed') === '1';
  if (!dismissed) {
    openGuide();
  }
}

function switchLang(targetLang) {
  const params = new URLSearchParams(window.location.search);
  params.set('lang', targetLang);
  window.location.search = params.toString();
}

// Start
document.addEventListener('DOMContentLoaded', init);
