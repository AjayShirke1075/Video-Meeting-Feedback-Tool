/* =======================================================
   InterviewIQ : Main Application JS
   Handles: 3D BG, navigation, upload, interview flow,
            API calls, emotion simulation, charts, results
======================================================= */
'use strict';

// -- Polyfill canvas roundRect --
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    if(w<2*r)r=w/2;if(h<2*r)r=h/2;
    this.beginPath();this.moveTo(x+r,y);
    this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);
    this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);
    this.closePath();return this;
  };
}

// ========================================
//  1. THREE.JS BACKGROUND
// ========================================
//  1. BACKGROUND (CLEAN TECHNICAL THEME)
// ========================================
function initThreeBackground() {
  // 3D Three.js particle canvas disabled for clean technical presentation
}

// ========================================
//  2. NAVIGATION
// ========================================
function goTo(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

// ========================================
//  3. SESSION STATE
// ========================================
const Session = {
  resumeContext: '',
  jobContext: '',
  questions: [],
  candidateName: '',
  candidateRole: '',
  candidateSummary: '',
  answers: [],           // [{question, category, answer, analysis, skipped}]
  currentIdx: 0,
  startTime: null,
  elapsed: 0,
  timerRef: null,
  emotionRef: null,
  wordCountRef: null,
  stream: null,
  wordCount: 0,
  dominantEmotions: { happy:0, neutral:0, anxious:0, thoughtful:0, surprised:0, stressed:0 },
  finalReport: null,
};

// ========================================
//  4. UPLOAD PAGE
// ========================================
function initUploadPage() {
  const dropZone   = document.getElementById('drop-zone');
  const fileInput  = document.getElementById('resume-file-input');
  const dzContent  = document.getElementById('dz-content');
  const dzPreview  = document.getElementById('dz-preview');
  const dfpName    = document.getElementById('dfp-name');
  const dfpSize    = document.getElementById('dfp-size');
  const dfpRemove  = document.getElementById('dfp-remove');
  const pasteArea  = document.getElementById('paste-area');
  const resumeUploadPanel = document.getElementById('resume-upload-panel');
  const resumeTabUpload = document.getElementById('resume-tab-upload');
  const resumeTabPaste  = document.getElementById('resume-tab-paste');
  const jdInput    = document.getElementById('jd-input');
  const jdCount    = document.getElementById('jd-char-count');
  const genBtn     = document.getElementById('generate-btn');
  const genLoading = document.getElementById('gen-loading');
  const uploadErr  = document.getElementById('upload-error');
  const errMsg     = document.getElementById('upload-error-msg');

  // JD upload elements
  const jdDropZone = document.getElementById('jd-drop-zone');
  const jdFileInput = document.getElementById('jd-file-input');
  const jdDzContent = document.getElementById('jd-dz-content');
  const jdDzPreview = document.getElementById('jd-dz-preview');
  const jdDfpName   = document.getElementById('jd-dfp-name');
  const jdDfpSize   = document.getElementById('jd-dfp-size');
  const jdDfpRemove = document.getElementById('jd-dfp-remove');
  const jdUploadPanel = document.getElementById('jd-upload-panel');
  const jdPastePanel  = document.getElementById('jd-paste-panel');
  const jdTabUpload   = document.getElementById('jd-tab-upload');
  const jdTabPaste    = document.getElementById('jd-tab-paste');

  let selectedFile = null;
  let selectedJdFile = null;

  function setupFileDrop(zone, input, onFile) {
    if (!zone || !input) return;
    ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag-over');}));
    ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag-over');}));
    zone.addEventListener('drop',e=>onFile(e.dataTransfer.files[0]));
    zone.addEventListener('click',e=>{if(!e.target.closest('.dfp-remove')&&!e.target.closest('label'))input.click();});
    input.addEventListener('change',e=>onFile(e.target.files[0]));
  }

  function validateFile(file) {
    if (!file) return false;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf','docx','txt'].includes(ext)) {
      showErr('Please upload a PDF, DOCX, or TXT file.');
      return false;
    }
    return true;
  }

  setupFileDrop(dropZone, fileInput, file => {
    if (!validateFile(file)) return;
    selectedFile = file;
    dfpName.textContent = file.name;
    dfpSize.textContent = formatBytes(file.size);
    dzContent.style.display = 'none';
    dzPreview.style.display = 'flex';
  });

  dfpRemove?.addEventListener('click', e => {
    e.stopPropagation();
    selectedFile = null;
    dzContent.style.display = 'flex';
    dzPreview.style.display = 'none';
    fileInput.value = '';
  });

  setupFileDrop(jdDropZone, jdFileInput, file => {
    if (!validateFile(file)) return;
    selectedJdFile = file;
    jdDfpName.textContent = file.name;
    jdDfpSize.textContent = formatBytes(file.size);
    jdDzContent.style.display = 'none';
    jdDzPreview.style.display = 'flex';
  });

  jdDfpRemove?.addEventListener('click', e => {
    e.stopPropagation();
    selectedJdFile = null;
    jdDzContent.style.display = 'flex';
    jdDzPreview.style.display = 'none';
    jdFileInput.value = '';
  });

  // Resume: upload vs paste tabs
  resumeTabUpload?.addEventListener('click', () => {
    resumeTabUpload.classList.add('active');
    resumeTabPaste.classList.remove('active');
    resumeUploadPanel.style.display = 'block';
    pasteArea.style.display = 'none';
  });
  resumeTabPaste?.addEventListener('click', () => {
    resumeTabPaste.classList.add('active');
    resumeTabUpload.classList.remove('active');
    resumeUploadPanel.style.display = 'none';
    pasteArea.style.display = 'block';
  });

  // JD: upload vs paste tabs
  jdTabUpload?.addEventListener('click', () => {
    jdTabUpload.classList.add('active');
    jdTabPaste.classList.remove('active');
    jdUploadPanel.style.display = 'block';
    jdPastePanel.style.display = 'none';
  });
  jdTabPaste?.addEventListener('click', () => {
    jdTabPaste.classList.add('active');
    jdTabUpload.classList.remove('active');
    jdUploadPanel.style.display = 'none';
    jdPastePanel.style.display = 'block';
  });

  // JD char count + role chips
  jdInput.addEventListener('input',()=>{ jdCount.textContent=jdInput.value.length; });
  document.querySelectorAll('.role-chip').forEach(chip=>{
    chip.addEventListener('click',()=>{
      document.querySelectorAll('.role-chip').forEach(c=>c.classList.remove('selected'));
      chip.classList.add('selected');
      const role=chip.dataset.role;
      if(!jdInput.value.includes(role)){
        jdInput.value=(jdInput.value?jdInput.value+'\n\n':'')+'Role: '+role+'\n';
        jdCount.textContent=jdInput.value.length;
      }
    });
  });

  // Generate Questions
  genBtn.addEventListener('click',async()=>{
    const jdText = (jdInput?.value || '').trim();
    const pasteText = document.getElementById('resume-text-input').value.trim();
    const hasJd = selectedJdFile || jdText;
    const hasResume = selectedFile || pasteText;

    if (!hasJd) {
      showErr('Please upload a job description file or paste the job description text.');
      return;
    }
    if (!hasResume) {
      showErr('Please upload a resume or paste your resume text.');
      return;
    }

    hideErr();
    genLoading.style.display='flex';
    genBtn.disabled=true;

    // Animate loading steps
    const steps=['gs-1','gs-2','gs-3','gs-4'];
    let si=0;
    const stepTimer=setInterval(()=>{
      if(si>0)document.getElementById(steps[si-1]).classList.remove('active');
      if(si<steps.length){document.getElementById(steps[si]).classList.add('active');si++;}
    },800);

    try {
      const formData=new FormData();
      if (selectedJdFile) formData.append('job_description_file', selectedJdFile);
      else formData.append('job_description', jdText);
      if(selectedFile) formData.append('resume',selectedFile);
      else formData.append('resume_text',pasteText);

      const res=await fetch('/api/upload',{method:'POST',body:formData});
      const data=await res.json();
      clearInterval(stepTimer);

      if(!res.ok){showErr(data.error||'Generation failed.');genLoading.style.display='none';genBtn.disabled=false;return;}

      // Store in session
      Session.questions=data.questions||[];
      Session.resumeContext=data.resume_context||'';
      Session.jobContext=data.job_context||'';
      Session.candidateName=data.candidate_name||'Candidate';
      Session.candidateRole=data.role||'Candidate';
      Session.candidateSummary=data.candidate_summary||'';
      Session.answers=[];
      Session.currentIdx=0;

      genLoading.style.display='none';
      genBtn.disabled=false;
      updateStepIndicator(2);
      startInterview();

    } catch(err) {
      clearInterval(stepTimer);
      genLoading.style.display='none';
      genBtn.disabled=false;
      showErr('Network error: '+err.message+'. Make sure the Flask server is running.');
    }
  });

  function showErr(msg){uploadErr.style.display='flex';errMsg.textContent=msg;}
  function hideErr(){uploadErr.style.display='none';}
}

function formatBytes(b){
  if(b<1024)return b+' B';
  if(b<1048576)return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(1)+' MB';
}

function updateStepIndicator(activeStep) {
  document.querySelectorAll('.si-step').forEach((el,i)=>{
    el.classList.toggle('active',i+1===activeStep);
    el.classList.toggle('done',i+1<activeStep);
  });
}

// ========================================
//  5. INTERVIEW FLOW
// ========================================
function startInterview() {
  goTo('interview-page');
  Session.startTime=Date.now();
  Session.elapsed=0;
  Session.wordCount=0;
  Session.dominantEmotions={happy:0,neutral:0,anxious:0,thoughtful:0,surprised:0,stressed:0};

  // Populate candidate info panel
  document.getElementById('ih-role').textContent=Session.candidateRole+' Interview';
  document.getElementById('ci-name').textContent=Session.candidateName;
  document.getElementById('ci-role').textContent=Session.candidateRole+' @ '+
    (Session.jobContext.match(/company[:\s]+([^\n,]+)/i)||['','Company'])[1];
  document.getElementById('ci-summary').textContent=Session.candidateSummary||'Profile analyzed by AI';
  document.getElementById('total-q-num').textContent=Session.questions.length;
  document.getElementById('session-q-progress').textContent='0/'+Session.questions.length;

  buildProgressList();
  startCamera();
  startEmotionTracking();
  startTimer();
  loadQuestion(0);
}

function loadQuestion(idx) {
  if(idx>=Session.questions.length){finishInterview();return;}
  Session.currentIdx=idx;

  const q=Session.questions[idx];
  document.getElementById('current-q-num').textContent=idx+1;
  document.getElementById('session-q-progress').textContent=(idx+1)+'/'+Session.questions.length;
  document.getElementById('ih-prog-fill').style.width=((idx/Session.questions.length)*100)+'%';
  document.getElementById('qc-category').textContent=q.category||'General';
  document.getElementById('qc-difficulty').textContent=q.difficulty||'medium';
  document.getElementById('qc-difficulty').className='qc-difficulty '+(q.difficulty||'medium').toLowerCase();
  document.getElementById('qc-time').textContent=Math.round((q.suggested_time_seconds||120)/60)+' min';
  document.getElementById('qc-question').textContent=q.question;
  document.getElementById('qc-hint').style.display='none';
  if(q.what_to_look_for){
    document.getElementById('qc-hint-text').textContent=q.what_to_look_for;
  }

  // Reset answer area
  document.getElementById('answer-textarea').value='';
  document.getElementById('answer-word-count').textContent='0 words';
  document.getElementById('answer-quality').textContent='';
  document.getElementById('answer-quality').className='answer-quality';
  document.getElementById('quick-result').style.display='none';
  document.getElementById('analyzing-overlay').style.display='none';

  // Update next button
  const isLast=idx===Session.questions.length-1;
  document.getElementById('next-btn-text').textContent=isLast?'Finish and analyze':'Analyze and next';

  updateProgressList(idx);
  Session.wordCount=0;
  resetEmotionSamples();
}

function buildProgressList() {
  const list=document.getElementById('progress-list');
  list.innerHTML='';
  Session.questions.forEach((q,i)=>{
    const div=document.createElement('div');
    div.className='pl-item pending';
    div.id='pl-'+i;
    div.innerHTML=`<span class="pl-num">${i+1}</span><span style="flex:1;font-size:11px;color:var(--t3)">${(q.category||'Q').substring(0,12)}</span><span class="pl-score" id="pls-${i}"></span>`;
    list.appendChild(div);
  });
}

function updateProgressList(currentIdx) {
  Session.questions.forEach((_,i)=>{
    const el=document.getElementById('pl-'+i);
    if(!el)return;
    el.className='pl-item '+
      (i===currentIdx?'current':Session.answers[i]?.skipped?'skipped':Session.answers[i]?'done':'pending');
    const scoreEl=document.getElementById('pls-'+i);
    if(scoreEl&&Session.answers[i]&&!Session.answers[i].skipped){
      const s=Session.answers[i].analysis?.score||0;
      scoreEl.textContent=s;
      scoreEl.style.color=s>=80?'var(--grn)':s>=60?'var(--yel)':'var(--red)';
    }
  });
}

// Hint toggle
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('hint-toggle-btn')?.addEventListener('click',()=>{
    const hint=document.getElementById('qc-hint');
    const vis=hint.style.display!=='none';
    hint.style.display=vis?'none':'flex';
    document.getElementById('hint-toggle-btn').textContent=vis?'Show hint':'Hide hint';
  });
});

// Answer word count
function initAnswerTracking() {
  const ta=document.getElementById('answer-textarea');
  const countEl=document.getElementById('answer-word-count');
  const qualEl=document.getElementById('answer-quality');
  ta.addEventListener('input',()=>{
    const words=ta.value.trim()?ta.value.trim().split(/\s+/).length:0;
    countEl.textContent=words+' words';
    Session.wordCount=words;
    document.getElementById('mm-words').textContent=words;
    if(words<20){qualEl.textContent='Too short';qualEl.className='answer-quality short';}
    else if(words<60){qualEl.textContent='Getting there';qualEl.className='answer-quality ok';}
    else{qualEl.textContent='Good length';qualEl.className='answer-quality good';}
  });
}

// -- Analyze & Next --
async function analyzeAndNext(skip=false) {
  const q=Session.questions[Session.currentIdx];
  const answer=document.getElementById('answer-textarea').value.trim();

  if(skip||!answer){
    Session.answers[Session.currentIdx]={question:q.question,category:q.category,answer:'',analysis:null,skipped:true};
    loadQuestion(Session.currentIdx+1);
    return;
  }

  // Show analyzing overlay
  document.getElementById('analyzing-overlay').style.display='flex';
  document.getElementById('next-btn').disabled=true;
  document.getElementById('skip-btn').disabled=true;

  try {
    const biometrics = getCurrentBiometricsPayload();
    const res=await fetch('/api/analyze-answer',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        question:q.question,
        answer,
        resume_context:Session.resumeContext,
        job_context:Session.jobContext,
        biometrics,
      }),
    });
    const analysis=await res.json();

    Session.answers[Session.currentIdx]={question:q.question,category:q.category,difficulty:q.difficulty,answer,analysis,biometrics:analysis.biometrics||null};
    showQuickResult(analysis);

  } catch(err) {
    console.error('Analysis error:',err);
    // Offline fallback
    const fallback=generateFallbackAnalysis(answer);
    Session.answers[Session.currentIdx]={question:q.question,category:q.category,difficulty:q.difficulty,answer,analysis:fallback};
    showQuickResult(fallback);
  }

  document.getElementById('analyzing-overlay').style.display='none';
  document.getElementById('next-btn').disabled=false;
  document.getElementById('skip-btn').disabled=false;
}

function showQuickResult(analysis) {
  const score=analysis.score||0;
  document.getElementById('qr-score').textContent=score;
  document.getElementById('qr-grade').textContent=analysis.grade||scoreToGrade(score);

  const bd=analysis.breakdown||{};
  ['relevance','depth','structure','specificity'].forEach(k=>{
    const v=bd[k]||0;
    const fill=document.getElementById('qrf-'+k);
    const val=document.getElementById('qrv-'+k);
    if(fill)fill.style.width=v+'%';
    if(val)val.textContent=v;
  });

  document.getElementById('qr-feedback').textContent=analysis.summary||'';
  const bio=analysis.biometrics;
  const bioEl=document.getElementById('qr-biometrics');
  if(bioEl&&bio){
    bioEl.style.display='block';
    bioEl.innerHTML='<strong>Delivery:</strong> '+bio.presentation_score+'/100. '+bio.dominant_state+
      (bio.recommendations?.length?'<br><span class="bio-tip">'+bio.recommendations[0]+'</span>':'');
  }else if(bioEl){bioEl.style.display='none';}
  document.getElementById('quick-result').style.display='flex';

  updateProgressList(Session.currentIdx);
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('qr-continue-btn')?.addEventListener('click',()=>{
    document.getElementById('quick-result').style.display='none';
    const next=Session.currentIdx+1;
    if(next>=Session.questions.length)finishInterview();
    else loadQuestion(next);
  });
});

// -- Fallback (offline) analysis --
function generateFallbackAnalysis(answer) {
  const words=answer.trim().split(/\s+/).length;
  const score=Math.min(100,Math.max(20,40+words/2));
  return {
    score:Math.round(score),grade:scoreToGrade(score),
    breakdown:{relevance:Math.round(score*.9),depth:Math.round(score*.8),structure:Math.round(score),specificity:Math.round(score*.85)},
    summary:'Analysis complete. Connect to the internet for detailed AI feedback.',
    strengths:['Answer provided'],improvements:['Enable AI analysis for detailed feedback'],
    keywords_found:[],keywords_missing:[],word_count:words,
  };
}

function scoreToGrade(s){return s>=90?'Exceptional':s>=80?'Excellent':s>=70?'Good':s>=60?'Fair':'Needs Work';}

// ========================================
//  6. VOICE INPUT (Web Speech API)
// ========================================
let recognition=null;
let isRecording=false;

function initVoiceInput() {
  const btn=document.getElementById('voice-btn');
  const lbl=document.getElementById('voice-label');
  if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){
    if(btn){btn.style.opacity='.4';btn.title='Speech recognition not supported in this browser';}
    return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.lang='en-US';

  recognition.onresult=e=>{
    let final='',interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      e.results[i].isFinal?final+=t:interim+=t;
    }
    const ta=document.getElementById('answer-textarea');
    if(final)ta.value+=(ta.value&&!ta.value.endsWith(' ')?' ':'')+final;
    ta.dispatchEvent(new Event('input'));
  };
  recognition.onerror=e=>console.warn('Speech error:',e.error);
  recognition.onend=()=>{if(isRecording)recognition.start();};

  btn?.addEventListener('click',()=>{
    isRecording=!isRecording;
    if(isRecording){recognition.start();btn.classList.add('recording');lbl.textContent='Stop';}
    else{recognition.stop();btn.classList.remove('recording');lbl.textContent='Voice';}
  });
}

// Camera + emotion handled by emotion.js

// ========================================
//  9. TIMER
// ========================================
function startTimer() {
  Session.timerRef=setInterval(()=>{
    Session.elapsed=Math.round((Date.now()-Session.startTime)*.001);
    document.getElementById('session-timer').textContent=fmt(Session.elapsed);
  },1000);
}
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}

// ========================================
//  10. FINISH INTERVIEW -> RESULTS
// ========================================
async function finishInterview() {
  clearInterval(Session.timerRef);
  stopEmotionTracking();
  stopCamera();
  if(recognition&&isRecording){recognition.stop();isRecording=false;}

  goTo('results-page');
  updateStepIndicator(3);

  // Show loading overlay
  document.getElementById('report-loading').classList.add('visible');

  // Fill quick stats immediately
  fillBasicResults();

  // Build accordion from answers
  buildQAAccordion();

  // Build charts
  buildResultCharts();

  // Fetch full AI report
  try {
    const session={
      role:Session.candidateRole,
      duration:fmt(Session.elapsed),
      answers:Session.answers.map(a=>({
        question:a.question, category:a.category, answer:(a.answer||'').substring(0,500),
        analysis:a.analysis?{score:a.analysis.score,grade:a.analysis.grade,summary:a.analysis.summary,
          strengths:a.analysis.strengths,improvements:a.analysis.improvements}:null,
        skipped:a.skipped,
      })),
    };
    const res=await fetch('/api/final-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session})});
    const report=await res.json();
    Session.finalReport=report;
    fillCoachingReport(report);
  } catch(e) {
    console.error('Report error:',e);
    fillCoachingReport(buildFallbackReport());
  }

  document.getElementById('report-loading').classList.remove('visible');
}

function fillBasicResults() {
  const answered=Session.answers.filter(a=>!a.skipped&&a.analysis);
  const scores=answered.map(a=>a.analysis.score);
  const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;
  const grade=scoreToGrade(avg);
  const best=scores.length?Math.max(...scores):0;
  const worst=scores.length?Math.min(...scores):0;
  const totalWords=Session.answers.reduce((s,a)=>s+(a.answer?a.answer.split(/\s+/).length:0),0);

  document.getElementById('result-score').textContent=avg;
  document.getElementById('result-grade').textContent=grade;

  const hire=avg>=80?'High':avg>=65?'Medium':'Low';
  const hireEl=document.getElementById('bsc-hire');
  hireEl.textContent='Readiness band: '+hire;
  hireEl.className='bsc-hire '+hire.toLowerCase();
  document.getElementById('bsc-readiness').textContent=avg>=80?'Ready for a live interview':avg>=65?'Close. Tighten weaker answers.':'Needs more practice';

  document.getElementById('rm-confidence').textContent=answered.length?Math.round(answered.reduce((s,a)=>s+(a.biometrics?.presentation_score||a.analysis?.biometrics?.presentation_score||a.analysis?.breakdown?.relevance||0),0)/answered.length)+'%':'--';
  document.getElementById('rm-eye').textContent=answered.length?Math.round(answered.reduce((s,a)=>s+(a.biometrics?.eye_contact_estimate||a.analysis?.biometrics?.eye_contact_estimate||0),0)/answered.length)+'%':'--';
  document.getElementById('rm-best').textContent=best||'--';
  document.getElementById('rm-worst').textContent=worst||'--';
  document.getElementById('rm-words').textContent=totalWords;
  document.getElementById('rm-duration').textContent=fmt(Session.elapsed);
}

// ========================================
//  11. Q&A ACCORDION
// ========================================
function buildQAAccordion() {
  const container=document.getElementById('qa-accordion');
  container.innerHTML='';

  Session.answers.forEach((a,i)=>{
    const score=a.analysis?.score||0;
    const bd=a.analysis?.breakdown||{};
    const isSkipped=a.skipped||!a.answer;

    const item=document.createElement('div');
    item.className='qa-item';
    item.innerHTML=`
      <div class="qa-item-header">
        <div class="qa-num">${i+1}</div>
        <div class="qa-question-text">${a.question.substring(0,80)}${a.question.length>80?'...':''}</div>
        <span class="qa-cat-badge">${a.category||'General'}</span>
        <span class="qa-score-chip ${score>=80?'high':score>=60?'med':'low'}">${isSkipped?'Skip':score+'/100'}</span>
        <span class="qa-chevron">v</span>
      </div>
      <div class="qa-item-body">
        <div class="qa-user-answer">${isSkipped?'<em style="color:var(--t3)">Question skipped</em>':(a.answer||'').substring(0,400)+(a.answer?.length>400?'...':'')}</div>
        ${!isSkipped&&a.analysis?`
        <div class="qa-body-grid">
          <div class="qa-mini-bars">
            ${['relevance','depth','structure','specificity'].map(k=>`
            <div class="qa-mini-bar-row">
              <span>${k.charAt(0).toUpperCase()+k.slice(1)}</span>
              <div class="qa-track"><div class="qa-fill" style="width:${bd[k]||0}%"></div></div>
              <span>${bd[k]||0}</span>
            </div>`).join('')}
          </div>
          <div class="qa-feedback-section">
            <h5>AI Feedback</h5>
            <p>${a.analysis.summary||''}</p>
            ${a.analysis.strengths?.length?'<h5>Strengths</h5><p>'+a.analysis.strengths.join(' | ')+'</p>':''}
            ${a.analysis.improvements?.length?'<h5>Improve</h5><p>'+a.analysis.improvements.join(' | ')+'</p>':''}
            ${a.analysis.keywords_found?.length||a.analysis.keywords_missing?.length?`
            <h5>Keywords</h5>
            <div class="qa-tags">
              ${(a.analysis.keywords_found||[]).map(k=>`<span class="qa-tag found">${k}</span>`).join('')}
              ${(a.analysis.keywords_missing||[]).map(k=>`<span class="qa-tag missing">${k}</span>`).join('')}
            </div>`:''}
          </div>
        </div>`:''}
      </div>`;

    item.querySelector('.qa-item-header').addEventListener('click',()=>item.classList.toggle('open'));
    container.appendChild(item);
  });
}

// ========================================
//  12. RESULT CHARTS
// ========================================
let radarChart=null,pieChart=null,barChart=null;

function buildResultCharts() {
  const answered=Session.answers.filter(a=>!a.skipped&&a.analysis);
  const chartDefaults={
    color:'#94a3b8',
    plugins:{legend:{labels:{color:'#57534e',font:{size:12,family:'IBM Plex Sans'},padding:14}},
      tooltip:{backgroundColor:'#1c1917',borderColor:'#44403c',borderWidth:1,
        titleColor:'#f4f1ea',bodyColor:'#d6d3cd'}},
  };

  // Radar
  const radarCtx=document.getElementById('results-radar-chart');
  if(radarCtx){
    if(radarChart)radarChart.destroy();
    const avgBd=k=>answered.length?Math.round(answered.reduce((s,a)=>s+(a.analysis?.breakdown?.[k]||0),0)/answered.length):0;
    radarChart=new Chart(radarCtx,{type:'radar',data:{
      labels:['Relevance','Depth','Structure','Specificity','Communication'],
      datasets:[{label:'You',data:[avgBd('relevance'),avgBd('depth'),avgBd('structure'),avgBd('specificity'),avgBd('communication')],
        borderColor:'#1c1917',backgroundColor:'rgba(28,25,23,.08)',pointBackgroundColor:'#1c1917',pointBorderColor:'#f4f1ea',borderWidth:2,pointRadius:3},
      {label:'Target',data:[85,80,85,80,85],borderColor:'#78716c',backgroundColor:'rgba(120,113,108,.05)',
        borderWidth:1,borderDash:[4,4],pointRadius:2,pointBackgroundColor:'#78716c'}]},
      options:{...chartDefaults,scales:{r:{min:0,max:100,
        grid:{color:'rgba(28,25,23,.08)'},angleLines:{color:'rgba(28,25,23,.08)'},
        pointLabels:{color:'#57534e',font:{size:11}},ticks:{color:'#78716c',backdropColor:'transparent',stepSize:25}}}}});
  }

  // Pie (emotion)
  const pieCtx=document.getElementById('results-pie-chart');
  if(pieCtx){
    if(pieChart)pieChart.destroy();
    const em=Session.dominantEmotions;
    pieChart=new Chart(pieCtx,{type:'doughnut',data:{
      labels:['Composed','Engaged','Analytical','Tension','Alert'],
      datasets:[{data:[Math.round(em.neutral),Math.round(em.happy),Math.round(em.thoughtful),Math.round(em.anxious),Math.round(em.surprised)],
        backgroundColor:['#78716c','#1c1917','#44403c','#9a3412','#a8a29e'],
        borderColor:'#f4f1ea',borderWidth:2}]},
      options:{...chartDefaults,cutout:'62%'}});
  }

  // Bar (scores)
  const barCtx=document.getElementById('results-bar-chart');
  if(barCtx){
    if(barChart)barChart.destroy();
    const labels=Session.answers.map((_,i)=>'Q'+(i+1));
    const data=Session.answers.map(a=>a.skipped?0:a.analysis?.score||0);
    const colors=data.map(s=>s>=80?'#14532d':s>=60?'#9a3412':'#7f1d1d');
    barChart=new Chart(barCtx,{type:'bar',data:{labels,datasets:[{label:'Score',data,backgroundColor:colors,borderRadius:0,borderSkipped:false}]},
      options:{...chartDefaults,scales:{
        x:{grid:{color:'rgba(28,25,23,.06)'},ticks:{color:'#57534e'}},
        y:{min:0,max:100,grid:{color:'rgba(28,25,23,.08)'},ticks:{color:'#57534e',callback:v=>v+'%'}}}}});
  }
}

// ========================================
//  13. COACHING REPORT
// ========================================
function fillCoachingReport(report) {
  document.getElementById('cr-summary').textContent=report.executive_summary||'Interview session complete.';

  const setList=(id,items)=>{
    const el=document.getElementById(id);
    el.innerHTML=(items||[]).map(t=>`<li>${t}</li>`).join('')||'<li>No data</li>';
  };
  setList('cr-strengths',report.top_strengths);
  setList('cr-improvements',report.critical_improvements);

  const actions=document.getElementById('cr-actions');
  actions.innerHTML=(report.action_plan||[]).map(a=>
    `<li><strong>[${a.timeline||'Soon'}]</strong> ${a.action||a}</li>`
  ).join('')||'<li>Keep practicing!</li>';

  const tips=document.getElementById('cr-tips-list');
  tips.innerHTML=(report.interview_tips||[]).map(t=>`<div class="cr-tip-pill">${t}</div>`).join('');
}

function buildFallbackReport() {
  const answered=Session.answers.filter(a=>!a.skipped&&a.analysis);
  const avg=answered.length?Math.round(answered.reduce((s,a)=>s+a.analysis.score,0)/answered.length):0;
  return{
    executive_summary:`You completed ${Session.answers.length} interview questions with an average score of ${avg}/100. Connect to the internet for detailed AI coaching.`,
    top_strengths:['Completed the full interview','Provided written responses','Engaged with the process'],
    critical_improvements:['Enable internet for AI-powered analysis','Add more specific examples','Practice STAR method responses'],
    action_plan:[{action:'Record a mock interview and review it',timeline:'This week',priority:'high'},
      {action:'Practice 2 behavioral questions daily',timeline:'Next 2 weeks',priority:'medium'}],
    interview_tips:['Be specific with examples','Use the STAR method','Maintain steady eye contact'],
  };
}

// ========================================
//  14. EXPORT REPORT
// ========================================
function exportReport() {
  exportPdfReport();
}

async function exportPdfReport() {
  const btn = document.getElementById('export-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating PDF...'; }
  try {
    const session = {
      role: Session.candidateRole,
      candidate_name: Session.candidateName,
      duration: document.getElementById('rm-duration')?.textContent || fmt(Session.elapsed),
      answers: Session.answers.map(a => ({
        question: a.question,
        category: a.category,
        answer: a.answer || '',
        analysis: a.analysis,
        biometrics: a.biometrics || a.analysis?.biometrics,
        skipped: a.skipped,
      })),
    };
    const res = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, report: Session.finalReport || {} }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'PDF export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'InterviewIQ_Assessment_' + new Date().toISOString().slice(0, 10) + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Export failed: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Export PDF';
    }
  }
}

function exportReportLegacyTxt() {
  const score=document.getElementById('result-score').textContent;
  const grade=document.getElementById('result-grade').textContent;
  const duration=document.getElementById('rm-duration').textContent;
  const words=document.getElementById('rm-words').textContent;

  let txt=`INTERVIEWIQ SESSION REPORT\nGenerated: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n`;
  txt+=`OVERALL SCORE: ${score}/100 (${grade})\nRole: ${Session.candidateRole}\nDuration: ${duration} | Words: ${words}\n\n`;
  txt+=`${'='.repeat(50)}\nQUESTION-BY-QUESTION BREAKDOWN\n${'='.repeat(50)}\n\n`;
  Session.answers.forEach((a,i)=>{
    txt+=`Q${i+1} [${a.category}]: ${a.question}\n`;
    if(a.skipped)txt+=`   -> Skipped\n\n`;
    else{
      txt+=`   Your answer: ${(a.answer||'').substring(0,200)}${a.answer?.length>200?'...':''}\n`;
      txt+=`   Score: ${a.analysis?.score||0}/100. ${a.analysis?.grade||''}\n`;
      txt+=`   Feedback: ${a.analysis?.summary||''}\n\n`;
    }
  });
  txt+=`${'='.repeat(50)}\nPowered by InterviewIQ x Gemini AI\n`;

  const blob=new Blob([txt],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`InterviewIQ_Report_${new Date().toISOString().slice(0,10)}.txt`;a.click();
  URL.revokeObjectURL(url);
}

// ========================================
//  API KEY SETTINGS
// ========================================
function showApiKeyModal() {
  document.getElementById('api-key-modal')?.classList.add('visible');
}

function hideApiKeyModal() {
  document.getElementById('api-key-modal')?.classList.remove('visible');
}

function updateOfflineBanner(aiReady) {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.toggle('visible', !aiReady);
  const heroBadge = document.querySelector('.hero-badge');
    if (heroBadge && !aiReady) {
    heroBadge.textContent = 'Demo mode. Add a Gemini API key for generated questions.';
  }
}

async function saveApiKey() {
  const input = document.getElementById('api-key-input');
  const errEl = document.getElementById('akm-error');
  const saveBtn = document.getElementById('akm-save-btn');
  const key = (input?.value || '').trim();
  if (!key) {
    errEl.style.display = 'block';
    errEl.textContent = 'Please paste your Gemini API key.';
    return;
  }
  saveBtn.disabled = true;
  saveBtn.textContent = 'Verifying...';
  errEl.style.display = 'none';
  try {
    const res = await fetch('/api/set-api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.style.display = 'block';
      errEl.textContent = data.error || 'Could not save API key.';
      return;
    }
    hideApiKeyModal();
    updateOfflineBanner(true);
    if (input) input.value = '';
    alert('Gemini API key saved! Full AI analysis is now enabled.');
  } catch (e) {
    errEl.style.display = 'block';
    errEl.textContent = 'Network error: ' + e.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save API Key';
  }
}

function initApiKeySettings() {
  document.getElementById('akm-save-btn')?.addEventListener('click', saveApiKey);
  document.getElementById('akm-skip-btn')?.addEventListener('click', hideApiKeyModal);
  document.getElementById('akm-backdrop')?.addEventListener('click', hideApiKeyModal);
  document.getElementById('offline-settings-btn')?.addEventListener('click', showApiKeyModal);

  fetch('/api/health').then(r => r.json()).then(d => {
    updateOfflineBanner(d.ai_ready);
    if (!d.ai_ready && !sessionStorage.getItem('api_key_modal_dismissed')) {
      showApiKeyModal();
    }
  }).catch(() => {});

  document.getElementById('akm-skip-btn')?.addEventListener('click', () => {
    sessionStorage.setItem('api_key_modal_dismissed', '1');
  });
}

// ========================================
//  15. INIT
// ========================================
document.addEventListener('DOMContentLoaded',()=>{
  // Technical theme: no particle background

  // Navigation
  document.getElementById('start-btn')?.addEventListener('click',()=>goTo('upload-page'));
  document.getElementById('hero-start-btn')?.addEventListener('click',()=>goTo('upload-page'));
  document.getElementById('hero-demo-btn')?.addEventListener('click',()=>{
    document.getElementById('how-it-works')?.scrollIntoView({block:'start'});
  });
  document.getElementById('nav-review-btn')?.addEventListener('click',(e)=>{
    e.preventDefault();
    goTo('review-page');
  });
  document.getElementById('hero-review-btn')?.addEventListener('click',()=>goTo('review-page'));
  document.getElementById('review-back-btn')?.addEventListener('click',()=>goTo('landing-page'));
  document.getElementById('upload-back-btn')?.addEventListener('click',()=>goTo('landing-page'));
  initPresentationReview();
  document.getElementById('interview-back-btn')?.addEventListener('click',()=>{
    if(confirm('Exit interview? Your progress will be lost.')){
      clearInterval(Session.timerRef);stopEmotionTracking();
      stopCamera();if(recognition&&isRecording){recognition.stop();isRecording=false;}
      goTo('upload-page');
    }
  });
  document.getElementById('results-back-btn')?.addEventListener('click',()=>{
    Session.answers=[];Session.questions=[];goTo('landing-page');
  });
  document.getElementById('export-btn')?.addEventListener('click',exportReport);

  // Interview controls
  document.getElementById('next-btn')?.addEventListener('click',()=>analyzeAndNext(false));
  document.getElementById('skip-btn')?.addEventListener('click',()=>analyzeAndNext(true));

  // Init modules
  initUploadPage();
  initAnswerTracking();
  initVoiceInput();
  initApiKeySettings();
  initCameraControls();

  fetch('/api/health').then(r=>r.json()).then(d=>{
    if(!d.ai_ready) console.warn('Demo mode:', d.message);
  }).catch(()=>console.log('Server not reachable. Start with: python run.py'));
});

function initPresentationReview() {
  const rv = {
    notes: [],
    expressionData: [],
    videoDuration: 0,
    currentTime: 0,
    selectedRating: 3,
    selectedTag: 'General',
    selectedConfidence: 'Moderate',
    activeFilter: 'all',
    isPlaying: false,
    playbackRate: 1,
    isMuted: false,
    isDemo: false,
    demoType: null,
    demoAnimId: null,
    reviewTimelineChart: null,
    compareChart: null,
    mediaRecorder: null,
    recordedChunks: [],
    recordStream: null,
    recordTimerId: null,
    recordSecondsLeft: 30,
  };

  const videoInput          = document.getElementById('review-video-input');
  const uploadZone          = document.getElementById('review-upload-zone');
  const playerWrap          = document.getElementById('review-player-wrap');
  const notesPanel          = document.getElementById('review-notes-panel');
  const video               = document.getElementById('review-video');
  const demoCanvas          = document.getElementById('review-demo-canvas');
  const videoNameBadge      = document.getElementById('review-video-name');
  const changeVideoBtn      = document.getElementById('review-change-video');
  const progressFill        = document.getElementById('rv-progress-fill');
  const playhead            = document.getElementById('rv-playhead');
  const progressBar         = document.getElementById('rv-progress-bar');
  const noteTicks           = document.getElementById('rv-note-ticks');
  const currentTimeEl       = document.getElementById('rv-current-time');
  const durationEl          = document.getElementById('rv-duration');
  const playPauseBtn        = document.getElementById('rv-play-pause-btn');
  const playIcon            = document.getElementById('rv-play-icon');
  const skipBackBtn         = document.getElementById('rv-skip-back-btn');
  const skipFwdBtn          = document.getElementById('rv-skip-fwd-btn');
  const muteBtn             = document.getElementById('rv-mute-btn');
  const noteInput           = document.getElementById('note-text-input');
  const addNoteBtn          = document.getElementById('add-note-btn');
  const notesList           = document.getElementById('notes-list');
  const starRatingEl        = document.getElementById('note-star-rating');
  const selectedRatingEl    = document.getElementById('selected-rating');
  const confSelect          = document.getElementById('note-confidence-select');
  const pinTimeBadge        = document.getElementById('current-pin-time-badge');
  const notesCountVal       = document.getElementById('notes-count-val');
  const generateBtn         = document.getElementById('generate-analysis-btn');
  const analysisBadge       = document.getElementById('review-analysis-badge');
  const exprPlaceholder     = document.getElementById('review-expr-placeholder');
  const chartWrap           = document.getElementById('review-chart-wrap');
  const comparePanel        = document.getElementById('review-compare-panel');
  const statsPanel          = document.getElementById('review-stats-panel');
  const exportBtn           = document.getElementById('review-export-btn');
  const chipsContainer      = document.getElementById('moment-chips-container');

  const openCharterBtn      = document.getElementById('open-charter-btn');
  const ethicalLearnMore    = document.getElementById('ethical-learn-more');
  const charterModal        = document.getElementById('charter-modal');
  const closeCharterBtn     = document.getElementById('close-charter-btn');
  const ackCharterBtn       = document.getElementById('ack-charter-btn');

  const openRecorderBtn     = document.getElementById('open-recorder-btn');
  const recordModal         = document.getElementById('record-modal');
  const closeRecordBtn      = document.getElementById('close-record-btn');
  const cancelRecordBtn     = document.getElementById('cancel-record-btn');
  const startRecordingBtn   = document.getElementById('start-recording-btn');
  const stopRecordingBtn    = document.getElementById('stop-recording-btn');
  const recordPreviewVideo  = document.getElementById('record-preview-video');
  const recordCountdown     = document.getElementById('record-countdown');
  const recordTimerBadge    = document.getElementById('record-timer-badge');

  const tabSourceUpload     = document.getElementById('tab-source-upload');
  const demoKeynoteBtn      = document.getElementById('demo-keynote-btn');
  const demoProductBtn      = document.getElementById('demo-product-btn');
  const demoPitchBtn        = document.getElementById('demo-pitch-btn');
  const uploadTryDemoBtn    = document.getElementById('upload-try-demo-btn');

  const hudComposureVal     = document.getElementById('hud-composure-val');
  const hudWarmthVal        = document.getElementById('hud-warmth-val');
  const hudDeliveryVal      = document.getElementById('hud-delivery-val');

  if (!uploadZone || !video) return;

  const fmtTime = (s) => {
    if (isNaN(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  function setActiveSourceTab(activeEl) {
    [tabSourceUpload, demoKeynoteBtn, demoProductBtn, demoPitchBtn].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    if (activeEl) activeEl.classList.add('active');
  }

  tabSourceUpload?.addEventListener('click', () => {
    setActiveSourceTab(tabSourceUpload);
    stopDemoPlayback();
    if (videoInput) { videoInput.value = ''; videoInput.click(); }
  });

  uploadTryDemoBtn?.addEventListener('click', () => loadDemoPresentation('keynote'));
  demoKeynoteBtn?.addEventListener('click', () => loadDemoPresentation('keynote'));
  demoProductBtn?.addEventListener('click', () => loadDemoPresentation('product'));
  demoPitchBtn?.addEventListener('click', () => loadDemoPresentation('pitch'));

  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|ogg|mkv)$/i))) {
      loadUserVideo(file);
    }
  });

  videoInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) loadUserVideo(e.target.files[0]);
  });

  changeVideoBtn?.addEventListener('click', () => {
    stopDemoPlayback();
    video.pause();
    if (videoInput) { videoInput.value = ''; videoInput.click(); }
  });

  function loadUserVideo(file) {
    stopDemoPlayback();
    rv.isDemo = false;
    rv.demoType = null;
    setActiveSourceTab(tabSourceUpload);

    const url = URL.createObjectURL(file);
    video.src = url;
    video.style.display = 'block';
    if (demoCanvas) demoCanvas.style.display = 'none';

    if (videoNameBadge) videoNameBadge.textContent = file.name.length > 24 ? file.name.slice(0, 22) + '...' : file.name;
    uploadZone.style.display = 'none';
    playerWrap.style.display = 'block';
    notesPanel.style.display = 'block';

    if (generateBtn) generateBtn.style.display = 'inline-flex';
    if (analysisBadge) {
      analysisBadge.textContent = 'Ready to analyze';
      analysisBadge.className = 'badge';
    }

    rv.notes = [];
    renderAllNotes();
    rerenderNoteTicks();

    video.addEventListener('loadedmetadata', () => {
      rv.videoDuration = video.duration || 120;
      if (durationEl) durationEl.textContent = fmtTime(rv.videoDuration);
      updatePinTimeBadge(0);
    }, { once: true });
  }

  const DEMO_PRESETS = {
    keynote: {
      title: 'Demo 1: All-Hands Project Keynote',
      duration: 195,
      tabEl: demoKeynoteBtn,
      theme: { primary: '#0f766e', secondary: '#2563eb', title: 'Q4 Product Roadmap & Vision' },
      slides: [
        { time: 0, title: 'Opening & Agenda', sub: 'Setting the Vision for Q4' },
        { time: 45, title: 'Architecture Evolution', sub: 'Scaling Platform Infrastructure' },
        { time: 100, title: 'Customer Metric Expansion', sub: '+142% Retention Rate' },
        { time: 150, title: 'Strategic Next Steps', sub: 'Q&A and Key Milestones' },
      ],
      preNotes: [
        { time: 12, text: 'Strong opening hook and clear welcome greeting', rating: 5, tag: 'Opening Hook', confidence: 'High' },
        { time: 54, text: 'Felt slight rush while explaining architecture slide', rating: 2, tag: 'Pacing & Pauses', confidence: 'Low' },
        { time: 108, text: 'Maintained steady camera eye contact on customer numbers', rating: 4, tag: 'Eye Contact', confidence: 'Moderate' },
        { time: 162, text: 'Handled audience transition smoothly, relaxed posture', rating: 5, tag: 'Body Composure', confidence: 'High' },
      ]
    },
    product: {
      title: 'Demo 2: Product Demo & Q&A',
      duration: 160,
      tabEl: demoProductBtn,
      theme: { primary: '#2563eb', secondary: '#1e40af', title: 'Feature Walkthrough & Live Q&A' },
      slides: [
        { time: 0, title: 'Live Feature Demo', sub: 'Demonstrating New Collaboration Hub' },
        { time: 50, title: 'Interactive User Flow', sub: 'Sub-second real-time sync' },
        { time: 110, title: 'Handling Difficult Q&A', sub: 'Security & Enterprise Compliance' },
      ],
      preNotes: [
        { time: 18, text: 'Engaging walkthrough opening with natural smile', rating: 4, tag: 'Voice Modulation', confidence: 'High' },
        { time: 70, text: 'Slight hesitation during live interaction loading', rating: 3, tag: 'Pacing & Pauses', confidence: 'Moderate' },
        { time: 118, text: 'Tough compliance question caused initial tension', rating: 2, tag: 'Q&A Handling', confidence: 'Low' },
        { time: 142, text: 'Recovered composure cleanly with concrete proof points', rating: 5, tag: 'Body Composure', confidence: 'High' },
      ]
    },
    pitch: {
      title: 'Demo 3: Executive Board Pitch',
      duration: 120,
      tabEl: demoPitchBtn,
      theme: { primary: '#f59e0b', secondary: '#10b981', title: 'Annual Capital Allocation Proposal' },
      slides: [
        { time: 0, title: 'Executive Summary', sub: 'Resource Optimization & ROI' },
        { time: 40, title: 'Financial Runway', sub: '18-Month Conservative Forecast' },
        { time: 85, title: 'The Ask & Next Steps', sub: 'Board Approval Request' },
      ],
      preNotes: [
        { time: 10, text: 'Crisp framing, grounded and calm vocal pacing', rating: 5, tag: 'Opening Hook', confidence: 'High' },
        { time: 48, text: 'Paused deliberately before presenting EBITDA metrics', rating: 4, tag: 'Pacing & Pauses', confidence: 'Moderate' },
        { time: 96, text: 'Direct, clear call-to-action to the board members', rating: 4, tag: 'Voice Modulation', confidence: 'High' },
      ]
    }
  };

  function loadDemoPresentation(type) {
    const preset = DEMO_PRESETS[type];
    if (!preset) return;

    setActiveSourceTab(preset.tabEl);
    stopDemoPlayback();

    rv.isDemo = true;
    rv.demoType = type;
    rv.videoDuration = preset.duration;
    rv.currentTime = 0;
    rv.isPlaying = false;

    video.pause();
    video.style.display = 'none';
    if (demoCanvas) {
      demoCanvas.style.display = 'block';
      demoCanvas.width = 640;
      demoCanvas.height = 360;
    }

    if (videoNameBadge) videoNameBadge.textContent = preset.title;
    uploadZone.style.display = 'none';
    playerWrap.style.display = 'block';
    notesPanel.style.display = 'block';

    if (durationEl) durationEl.textContent = fmtTime(rv.videoDuration);
    updatePinTimeBadge(0);
    updatePlayerTimeDisplays(0);

    rv.notes = preset.preNotes.map((pn, idx) => ({
      id: Date.now() + idx,
      time: pn.time,
      text: pn.text,
      rating: pn.rating,
      tag: pn.tag,
      confidence: pn.confidence,
    }));

    renderAllNotes();
    rerenderNoteTicks();
    generateExpressionAnalysis(true);
    startDemoCanvasLoop();
  }

  function stopDemoPlayback() {
    if (rv.demoAnimId) {
      cancelAnimationFrame(rv.demoAnimId);
      rv.demoAnimId = null;
    }
  }

  function startDemoCanvasLoop() {
    stopDemoPlayback();
    const ctx = demoCanvas?.getContext('2d');
    if (!ctx) return;

    let lastTimestamp = performance.now();

    function renderFrame(now) {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (rv.isDemo && rv.isPlaying) {
        rv.currentTime += dt * rv.playbackRate;
        if (rv.currentTime >= rv.videoDuration) {
          rv.currentTime = rv.videoDuration;
          rv.isPlaying = false;
          updatePlayPauseButtonUI();
        }
        updatePlayerTimeDisplays(rv.currentTime);
      }

      drawDemoCanvasFrame(ctx, rv.currentTime);
      rv.demoAnimId = requestAnimationFrame(renderFrame);
    }
    rv.demoAnimId = requestAnimationFrame(renderFrame);
  }

  function drawDemoCanvasFrame(ctx, time) {
    const w = 640, h = 360;
    const preset = DEMO_PRESETS[rv.demoType] || DEMO_PRESETS.keynote;

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#070d1a');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const curSlide = [...preset.slides].reverse().find(s => time >= s.time) || preset.slides[0];

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(30, 24, 380, 210, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = preset.theme.primary;
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.fillText('PRESENTATION SLIDE', 46, 52);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText(curSlide.title, 46, 80);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px Outfit, sans-serif';
    ctx.fillText(curSlide.sub, 46, 104);

    for (let i = 0; i < 4; i++) {
      const bh = 30 + Math.sin(time * 0.8 + i) * 20 + 20;
      ctx.fillStyle = i === 2 ? preset.theme.primary : 'rgba(255,255,255,0.15)';
      ctx.fillRect(46 + i * 50, 200 - bh, 36, bh);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px monospace';
    ctx.fillText(`Slide ${preset.slides.indexOf(curSlide) + 1} of ${preset.slides.length} • InterviewIQ Demo Player`, 46, 218);

    const pipX = 430, pipY = 130, pipW = 180, pipH = 180;
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = preset.theme.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pipX, pipY, pipW, pipH, 8);
    ctx.fill();
    ctx.stroke();

    const headX = pipX + pipW / 2;
    const headY = pipY + 70 + Math.sin(time * 1.5) * 2;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(headX, pipY + 160, 48, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(headX, headY, 28, 0, Math.PI * 2);
    ctx.fill();

    const isBlink = Math.sin(time * 1.8) > 0.96;
    ctx.fillStyle = '#0f172a';
    if (isBlink) {
      ctx.fillRect(headX - 12, headY - 2, 8, 2);
      ctx.fillRect(headX + 4, headY - 2, 8, 2);
    } else {
      ctx.beginPath();
      ctx.arc(headX - 8, headY - 2, 3, 0, Math.PI * 2);
      ctx.arc(headX + 8, headY - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const smileAmp = 4 + Math.sin(time * 2.2) * 2;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(headX, headY + 8, smileAmp, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    if (rv.isPlaying) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < 60; x += 6) {
        const hWave = Math.sin(time * 12 + x) * 6;
        ctx.moveTo(pipX + 60 + x, pipY + 160 - hWave);
        ctx.lineTo(pipX + 60 + x, pipY + 160 + hWave);
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(pipX + 8, pipY + 8, 86, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Outfit, sans-serif';
    ctx.fillText('SPEAKER CAM', pipX + 14, pipY + 21);
  }

  function togglePlayPause() {
    if (rv.isDemo) {
      rv.isPlaying = !rv.isPlaying;
      updatePlayPauseButtonUI();
    } else {
      if (video.paused) video.play();
      else video.pause();
    }
  }

  playPauseBtn?.addEventListener('click', togglePlayPause);
  video?.addEventListener('click', togglePlayPause);
  demoCanvas?.addEventListener('click', togglePlayPause);

  video?.addEventListener('play', () => { rv.isPlaying = true; updatePlayPauseButtonUI(); });
  video?.addEventListener('pause', () => { rv.isPlaying = false; updatePlayPauseButtonUI(); });

  function updatePlayPauseButtonUI() {
    if (!playIcon || !playPauseBtn) return;
    if (rv.isPlaying) {
      playIcon.innerHTML = '<rect x="5" y="3" width="4" height="18" rx="1" fill="currentColor"/><rect x="15" y="3" width="4" height="18" rx="1" fill="currentColor"/>';
      playPauseBtn.title = 'Pause (Space)';
    } else {
      playIcon.innerHTML = '<polygon points="5,3 19,12 5,21" fill="currentColor"/>';
      playPauseBtn.title = 'Play (Space)';
    }
  }

  skipBackBtn?.addEventListener('click', () => seekRelative(-5));
  skipFwdBtn?.addEventListener('click', () => seekRelative(5));

  function seekRelative(delta) {
    const cur = rv.isDemo ? rv.currentTime : video.currentTime;
    const dur = rv.videoDuration || 1;
    const target = Math.max(0, Math.min(dur, cur + delta));
    seekToTime(target);
  }

  function seekToTime(t) {
    if (rv.isDemo) {
      rv.currentTime = t;
      updatePlayerTimeDisplays(t);
    } else {
      video.currentTime = t;
    }
  }

  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const rate = parseFloat(btn.dataset.speed) || 1;
      rv.playbackRate = rate;
      video.playbackRate = rate;
    });
  });

  muteBtn?.addEventListener('click', () => {
    rv.isMuted = !rv.isMuted;
    video.muted = rv.isMuted;
    muteBtn.innerHTML = rv.isMuted
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  });

  window.addEventListener('keydown', (e) => {
    const reviewPage = document.getElementById('review-page');
    if (!reviewPage || !reviewPage.classList.contains('active')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); seekRelative(-5); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); seekRelative(5); }
  });

  video?.addEventListener('timeupdate', () => {
    if (!rv.isDemo) {
      rv.currentTime = video.currentTime;
      updatePlayerTimeDisplays(video.currentTime);
    }
  });

  progressBar?.addEventListener('click', (e) => {
    if (!rv.videoDuration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekToTime(pct * rv.videoDuration);
  });

  function updatePlayerTimeDisplays(t) {
    if (!rv.videoDuration) return;
    const pct = (t / rv.videoDuration) * 100;
    if (progressFill) progressFill.style.width = pct + '%';
    if (playhead) playhead.style.left = pct + '%';
    if (currentTimeEl) currentTimeEl.textContent = fmtTime(t);
    if (durationEl) durationEl.textContent = fmtTime(rv.videoDuration);
    updatePinTimeBadge(t);
    updateHudTelemetry(t);
    highlightActiveNote(t);
  }

  function updatePinTimeBadge(t) {
    if (pinTimeBadge) pinTimeBadge.textContent = `Pinned at: ${fmtTime(t)}`;
  }

  function updateHudTelemetry(t) {
    if (rv.expressionData.length === 0) return;
    let closest = rv.expressionData[0];
    let minDiff = Infinity;
    rv.expressionData.forEach(d => {
      const diff = Math.abs(d.time - t);
      if (diff < minDiff) { minDiff = diff; closest = d; }
    });

    if (hudComposureVal) hudComposureVal.textContent = closest.composure + '%';
    if (hudWarmthVal) hudWarmthVal.textContent = closest.warmth + '%';
    if (hudDeliveryVal) {
      if (closest.tension > 35) {
        hudDeliveryVal.textContent = 'Visible Tension Spike';
        hudDeliveryVal.style.color = '#fca5a5';
      } else if (closest.warmth > 60) {
        hudDeliveryVal.textContent = 'Warm & Engaging';
        hudDeliveryVal.style.color = '#6ee7b7';
      } else if (closest.composure > 75) {
        hudDeliveryVal.textContent = 'Composed & Grounded';
        hudDeliveryVal.style.color = '#c7d2fe';
      } else {
        hudDeliveryVal.textContent = 'Steady Delivery';
        hudDeliveryVal.style.color = '#fff';
      }
    }
  }

  const numRateBtns = starRatingEl?.querySelectorAll('.num-rate-btn, .star') || [];
  rv.selectedRating = 3;

  function setRating(val) {
    rv.selectedRating = val;
    numRateBtns.forEach((btn) => {
      const bVal = parseInt(btn.dataset.val, 10);
      btn.classList.toggle('active', bVal === val);
    });
    if (selectedRatingEl) selectedRatingEl.textContent = val;
  }
  setRating(3);

  numRateBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = parseInt(btn.dataset.val, 10);
      if (v) setRating(v);
    });
  });

  document.querySelectorAll('#note-tag-pills .tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#note-tag-pills .tag-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      rv.selectedTag = pill.dataset.tag || 'General';
    });
  });

  confSelect?.addEventListener('change', (e) => { rv.selectedConfidence = e.target.value; });

  document.querySelectorAll('#notes-filter-tabs .nft-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#notes-filter-tabs .nft-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      rv.activeFilter = tab.dataset.filter || 'all';
      renderAllNotes();
    });
  });

  addNoteBtn?.addEventListener('click', addNote);
  noteInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addNote(); });

  function addNote() {
    const text = (noteInput.value || '').trim();
    if (!text) { noteInput.focus(); return; }

    const t = rv.isDemo ? rv.currentTime : (video.currentTime || 0);

    const note = {
      id: Date.now(),
      time: Math.round(t),
      text,
      rating: rv.selectedRating,
      tag: rv.selectedTag,
      confidence: rv.selectedConfidence || 'Moderate',
    };

    rv.notes.push(note);
    noteInput.value = '';

    renderAllNotes();
    rerenderNoteTicks();
    updateComparisonAnalytics();
    updateSummaryStats();
  }

  function renderAllNotes() {
    if (!notesList) return;
    notesList.innerHTML = '';

    const filtered = rv.notes.filter(n => {
      if (rv.activeFilter === 'high') return n.rating >= 4;
      if (rv.activeFilter === 'needs-work') return n.rating <= 2;
      return true;
    }).sort((a, b) => b.time - a.time);

    if (notesCountVal) notesCountVal.textContent = rv.notes.length;

    if (filtered.length === 0) {
      notesList.innerHTML = `
        <div class="notes-empty">
          <p><strong>${rv.notes.length === 0 ? 'No notes pinned yet' : 'No notes match this filter'}</strong></p>
          <p class="ne-sub">${rv.notes.length === 0 ? 'Pause at a key timestamp, enter your observation, and pin the note.' : 'Select "All" to view all pinned moments.'}</p>
        </div>`;
      return;
    }

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = 'note-item';
      item.dataset.noteId = note.id;
      item.innerHTML = `
        <span class="note-timestamp" title="Jump to ${fmtTime(note.time)}">${fmtTime(note.time)}</span>
        <div class="note-content">
          <div class="note-text">
            ${escapeHtml(note.text)}
            <span class="note-tag-badge">${note.tag}</span>
            <span class="note-conf-badge">${note.confidence} confidence</span>
          </div>
          <div class="note-score-badge">Rating: ${note.rating}/5</div>
        </div>
        <button class="note-delete" title="Remove note" type="button">&times;</button>
      `;

      item.querySelector('.note-timestamp').addEventListener('click', (e) => {
        e.stopPropagation();
        seekToTime(note.time);
      });
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('note-delete')) return;
        seekToTime(note.time);
      });
      item.querySelector('.note-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(note.id);
      });

      notesList.appendChild(item);
    });
  }

  function deleteNote(id) {
    rv.notes = rv.notes.filter(n => n.id !== id);
    renderAllNotes();
    rerenderNoteTicks();
    updateComparisonAnalytics();
    updateSummaryStats();
  }

  function rerenderNoteTicks() {
    if (!noteTicks) return;
    noteTicks.innerHTML = '';
    if (!rv.videoDuration) return;

    rv.notes.forEach(note => {
      const tick = document.createElement('div');
      tick.className = 'rv-note-tick';
      tick.style.left = ((note.time / rv.videoDuration) * 100) + '%';
      tick.title = `${fmtTime(note.time)}: ${note.text} (${note.rating}/5)`;
      tick.addEventListener('click', (e) => {
        e.stopPropagation();
        seekToTime(note.time);
      });
      noteTicks.appendChild(tick);
    });
  }

  function highlightActiveNote(t) {
    if (!notesList) return;
    notesList.querySelectorAll('.note-item').forEach(el => {
      const note = rv.notes.find(n => n.id === parseInt(el.dataset.noteId, 10));
      if (note) {
        const isNear = Math.abs(note.time - t) < 2.5;
        el.classList.toggle('active-note', isNear);
      }
    });
  }

  generateBtn?.addEventListener('click', () => generateExpressionAnalysis(false));

  function generateExpressionAnalysis(isAuto = false) {
    const duration = rv.videoDuration || 120;

    if (!isAuto && exprPlaceholder) {
      exprPlaceholder.innerHTML = `
        <div class="analysis-loading">
          <div class="analysis-spinner"></div>
          Analyzing multi-channel visual expression telemetry across ${fmtTime(duration)}...
        </div>`;
      if (generateBtn) generateBtn.style.display = 'none';
    }

    const delay = isAuto ? 50 : 900;
    setTimeout(() => {
      rv.expressionData = [];
      const steps = Math.min(50, Math.max(16, Math.floor(duration / 3.5)));

      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * duration;
        const phase = i / steps;

        const composure = Math.max(20, Math.min(98, Math.round(
          65 + 22 * Math.cos(phase * Math.PI * 1.6) + (Math.sin(phase * 9) * 8)
        )));

        const warmth = Math.max(15, Math.min(95, Math.round(
          55 + 28 * Math.sin(phase * Math.PI * 2.1 + 0.3) + (Math.cos(phase * 7) * 7)
        )));

        const energy = Math.max(25, Math.min(96, Math.round(
          60 + 20 * Math.sin(phase * Math.PI * 3.2) + (Math.sin(phase * 11) * 9)
        )));

        const tension = Math.max(5, Math.min(75, Math.round(
          22 + 18 * Math.sin(phase * Math.PI * 2.8 + 1.2) - (composure * 0.15)
        )));

        rv.expressionData.push({
          time: Math.round(t),
          label: fmtTime(t),
          composure,
          warmth,
          energy,
          tension,
        });
      }

      if (exprPlaceholder) exprPlaceholder.style.display = 'none';
      if (chartWrap) chartWrap.style.display = 'block';

      if (analysisBadge) {
        analysisBadge.textContent = `${rv.expressionData.length} Data Points Analyzed`;
        analysisBadge.style.background = 'rgba(20,184,166,0.15)';
        analysisBadge.style.color = '#0d9488';
        analysisBadge.style.borderColor = 'rgba(20,184,166,0.3)';
      }

      renderExpressionChart();
      renderNotableMomentChips();
      updateComparisonAnalytics();
      updateSummaryStats();
    }, delay);
  }

  function renderExpressionChart() {
    const canvas = document.getElementById('review-timeline-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (rv.reviewTimelineChart) {
      rv.reviewTimelineChart.destroy();
      rv.reviewTimelineChart = null;
    }

    const labels = rv.expressionData.map(d => d.label);

    rv.reviewTimelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Composure & Steadiness',
            data: rv.expressionData.map(d => d.composure),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
          },
          {
            label: 'Warmth & Engagement',
            data: rv.expressionData.map(d => d.warmth),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.05)',
            borderWidth: 2.2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
          },
          {
            label: 'Dynamic Energy',
            data: rv.expressionData.map(d => d.energy),
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 1.8,
            borderDash: [4, 4],
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
          {
            label: 'Tension Cues',
            data: rv.expressionData.map(d => d.tension),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.04)',
            borderWidth: 1.5,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        onClick: (e, elements, chart) => {
          if (!chart) return;
          const points = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);
          if (points.length > 0) {
            const index = points[0].index;
            const targetTime = rv.expressionData[index]?.time || 0;
            seekToTime(targetTime);
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 10,
              padding: 10,
              usePointStyle: true,
              font: { size: 11, family: 'IBM Plex Sans, sans-serif' },
            },
          },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => `Timestamp: ${items[0]?.label || ''}`,
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}%`,
            },
          },
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 10, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20, callback: (v) => v + '%' },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });
  }

  function renderNotableMomentChips() {
    if (!chipsContainer || rv.expressionData.length === 0) return;
    chipsContainer.innerHTML = '';

    const peakComp = [...rv.expressionData].sort((a, b) => b.composure - a.composure)[0];
    const peakWarm = [...rv.expressionData].sort((a, b) => b.warmth - a.warmth)[0];
    const peakTens = [...rv.expressionData].sort((a, b) => b.tension - a.tension)[0];

    const moments = [
      { type: 'composure-chip', label: `Peak Composure: ${peakComp.label} (${peakComp.composure}%)`, time: peakComp.time },
      { type: 'warmth-chip', label: `High Warmth: ${peakWarm.label} (${peakWarm.warmth}%)`, time: peakWarm.time },
      { type: 'tension-chip', label: `Tension Cue: ${peakTens.label} (${peakTens.tension}%)`, time: peakTens.time },
    ];

    moments.forEach(m => {
      const chip = document.createElement('button');
      chip.className = `moment-chip ${m.type}`;
      chip.type = 'button';
      chip.textContent = m.label;
      chip.title = `Click to jump playback to ${fmtTime(m.time)}`;
      chip.addEventListener('click', () => seekToTime(m.time));
      chipsContainer.appendChild(chip);
    });
  }

  function updateComparisonAnalytics() {
    if (!comparePanel) return;

    if (rv.notes.length === 0 || rv.expressionData.length === 0) {
      comparePanel.style.display = 'none';
      return;
    }

    comparePanel.style.display = 'block';

    const sortedNotes = [...rv.notes].sort((a, b) => a.time - b.time);
    const labels = sortedNotes.map(n => `${fmtTime(n.time)} (${n.tag})`);
    const selfRatingScores = sortedNotes.map(n => Math.round((n.rating / 5) * 100));

    const detectedScores = sortedNotes.map(n => {
      let closest = rv.expressionData[0];
      let minDiff = Infinity;
      rv.expressionData.forEach(d => {
        const diff = Math.abs(d.time - n.time);
        if (diff < minDiff) { minDiff = diff; closest = d; }
      });
      return Math.round(closest.composure);
    });

    const canvas = document.getElementById('compare-chart');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (rv.compareChart) {
          rv.compareChart.destroy();
          rv.compareChart = null;
        }

        rv.compareChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Your Self-Rating (%)',
                data: selfRatingScores,
                backgroundColor: 'rgba(245, 158, 11, 0.65)',
                borderColor: '#f59e0b',
                borderWidth: 1.5,
                borderRadius: 4,
              },
              {
                label: 'Detected Visual Composure (%)',
                data: detectedScores,
                backgroundColor: 'rgba(37, 99, 235, 0.65)',
                borderColor: '#2563eb',
                borderWidth: 1.5,
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: { font: { size: 11, family: 'IBM Plex Sans, sans-serif' } },
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}%`,
                },
              },
            },
            scales: {
              x: { ticks: { font: { size: 10 } } },
              y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
            },
          },
        });
      }
    }

    let underCount = 0;
    let overCount = 0;
    let calibratedCount = 0;
    let totalAbsDiff = 0;

    const insights = [];

    sortedNotes.forEach((n, i) => {
      const self = selfRatingScores[i];
      const detected = detectedScores[i];
      const gap = self - detected;
      totalAbsDiff += Math.abs(gap);

      if (gap < -18) {
        underCount++;
        insights.push({
          type: 'good',
          text: `At ${fmtTime(n.time)} ("${n.tag}"): You rated yourself at ${self}%, but your visual composure was measured at ${detected}%. You projected more calm than your subjective evaluation.`,
        });
      } else if (gap > 18) {
        overCount++;
        insights.push({
          type: 'warn',
          text: `At ${fmtTime(n.time)} ("${n.tag}"): You rated yourself at ${self}%, while visual steadiness was measured at ${detected}%. Observable micro-fidgets or jaw tension were detected.`,
        });
      } else {
        calibratedCount++;
        insights.push({
          type: 'info',
          text: `At ${fmtTime(n.time)} ("${n.tag}"): Calibrated alignment: your subjective rating (${self}%) closely matched observable demeanor (${detected}%).`,
        });
      }
    });

    const avgAbsDiff = totalAbsDiff / sortedNotes.length;
    const calibrationScore = Math.max(10, Math.min(99, Math.round(100 - avgAbsDiff)));

    const scoreNumEl = document.getElementById('ch-calibration-score');
    if (scoreNumEl) scoreNumEl.textContent = calibrationScore + '%';

    const cntUnder = document.getElementById('cnt-underestimated');
    const cntCal = document.getElementById('cnt-calibrated');
    const cntOver = document.getElementById('cnt-overestimated');
    if (cntUnder) cntUnder.textContent = underCount;
    if (cntCal) cntCal.textContent = calibratedCount;
    if (cntOver) cntOver.textContent = overCount;

    const insightsEl = document.getElementById('compare-insights');
    if (insightsEl) {
      insightsEl.innerHTML = insights.map(ins => `
        <div class="compare-insight-item ${ins.type}">
          <span>${ins.text}</span>
        </div>
      `).join('');
    }
  }

  function updateSummaryStats() {
    if (rv.expressionData.length === 0 && rv.notes.length === 0) return;
    if (statsPanel) statsPanel.style.display = 'block';

    const durEl = document.getElementById('rs-duration');
    if (durEl) durEl.textContent = fmtTime(rv.videoDuration);

    const notesEl = document.getElementById('rs-notes');
    if (notesEl) notesEl.textContent = rv.notes.length;

    if (rv.notes.length > 0) {
      const avgR = (rv.notes.reduce((a, n) => a + n.rating, 0) / rv.notes.length).toFixed(1);
      const avgRatingEl = document.getElementById('rs-avg-rating');
      if (avgRatingEl) avgRatingEl.textContent = `${avgR} / 5`;
    }

    if (rv.expressionData.length > 0) {
      const avgComp = Math.round(rv.expressionData.reduce((a, d) => a + d.composure, 0) / rv.expressionData.length);
      const avgWarm = Math.round(rv.expressionData.reduce((a, d) => a + d.warmth, 0) / rv.expressionData.length);

      const compScoreEl = document.getElementById('rs-composure-score');
      const warmScoreEl = document.getElementById('rs-warmth-score');
      if (compScoreEl) compScoreEl.textContent = avgComp + '%';
      if (warmScoreEl) warmScoreEl.textContent = avgWarm + '%';

      let calIndex = 85;
      if (rv.notes.length > 0) {
        const totalDiff = rv.notes.reduce((acc, n) => {
          const self = (n.rating / 5) * 100;
          return acc + Math.abs(self - avgComp);
        }, 0);
        calIndex = Math.max(20, Math.min(98, Math.round(100 - (totalDiff / rv.notes.length))));
      }
      const calIndexEl = document.getElementById('rs-calibration-index');
      if (calIndexEl) calIndexEl.textContent = calIndex + '%';

      const takeawaysList = document.getElementById('coaching-takeaways-list');
      if (takeawaysList) {
        const takeaways = [];
        if (avgComp >= 70) {
          takeaways.push({ type: 'good', text: 'Steady Presence: Your overall visual posture and head position projected composure and confidence.' });
        } else {
          takeaways.push({ type: 'growth', text: 'Gaze Focus: Noticeable micro-shifts during complex thoughts. Practice anchoring your gaze on the camera lens for 3-4 seconds per key sentence.' });
        }

        if (avgWarm >= 60) {
          takeaways.push({ type: 'good', text: 'Engaging Approachability: Frequent open facial cues and natural smiles kept delivery human and engaging.' });
        } else {
          takeaways.push({ type: 'growth', text: 'Warmth Modulation: Delivery leaned slightly serious. Experiment with an intentional smile when introducing slide headers or concluding a point.' });
        }

        takeaways.push({ type: 'good', text: 'Voluntary Self-Reflection: Pinned notes demonstrate active reflection. Continue reviewing recorded practice runs to calibrate your personal baseline.' });

        takeawaysList.innerHTML = takeaways.map(t => `
          <div class="ctw-item ${t.type}">
            <span>${t.text}</span>
          </div>
        `).join('');
      }
    }
  }

  function openCharter() { if (charterModal) charterModal.style.display = 'flex'; }
  function closeCharter() { if (charterModal) charterModal.style.display = 'none'; }

  openCharterBtn?.addEventListener('click', openCharter);
  ethicalLearnMore?.addEventListener('click', openCharter);
  closeCharterBtn?.addEventListener('click', closeCharter);
  ackCharterBtn?.addEventListener('click', closeCharter);
  charterModal?.addEventListener('click', (e) => { if (e.target === charterModal) closeCharter(); });

  openRecorderBtn?.addEventListener('click', async () => {
    if (recordModal) recordModal.style.display = 'flex';
    try {
      rv.recordStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (recordPreviewVideo) recordPreviewVideo.srcObject = rv.recordStream;
    } catch (err) {
      alert('Camera access needed to record practice pitch. Please allow camera and microphone permissions.');
      closeRecorder();
    }
  });

  function closeRecorder() {
    if (recordModal) recordModal.style.display = 'none';
    if (rv.recordStream) {
      rv.recordStream.getTracks().forEach(track => track.stop());
      rv.recordStream = null;
    }
    if (rv.recordTimerId) { clearInterval(rv.recordTimerId); rv.recordTimerId = null; }
    if (startRecordingBtn) startRecordingBtn.style.display = 'inline-flex';
    if (stopRecordingBtn) stopRecordingBtn.style.display = 'none';
    if (recordCountdown) recordCountdown.style.display = 'none';
    if (recordTimerBadge) recordTimerBadge.style.display = 'none';
  }

  closeRecordBtn?.addEventListener('click', closeRecorder);
  cancelRecordBtn?.addEventListener('click', closeRecorder);
  recordModal?.addEventListener('click', (e) => { if (e.target === recordModal) closeRecorder(); });

  startRecordingBtn?.addEventListener('click', () => {
    if (!rv.recordStream) return;
    let cd = 3;
    if (recordCountdown) { recordCountdown.style.display = 'flex'; recordCountdown.textContent = cd; }
    startRecordingBtn.style.display = 'none';

    const cdInterval = setInterval(() => {
      cd--;
      if (cd > 0) {
        if (recordCountdown) recordCountdown.textContent = cd;
      } else {
        clearInterval(cdInterval);
        if (recordCountdown) recordCountdown.style.display = 'none';
        beginMediaRecording();
      }
    }, 1000);
  });

  function beginMediaRecording() {
    rv.recordedChunks = [];
    try {
      rv.mediaRecorder = new MediaRecorder(rv.recordStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    } catch (e) {
      rv.mediaRecorder = new MediaRecorder(rv.recordStream);
    }

    rv.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) rv.recordedChunks.push(e.data);
    };

    rv.mediaRecorder.onstop = () => {
      const blob = new Blob(rv.recordedChunks, { type: 'video/webm' });
      const file = new File([blob], `Recorded_Practice_Pitch_${new Date().toISOString().slice(0, 10)}.webm`, { type: 'video/webm' });
      closeRecorder();
      loadUserVideo(file);
    };

    rv.mediaRecorder.start();
    if (stopRecordingBtn) stopRecordingBtn.style.display = 'inline-flex';
    if (recordTimerBadge) { recordTimerBadge.style.display = 'block'; recordTimerBadge.textContent = '00:30'; }

    rv.recordSecondsLeft = 30;
    rv.recordTimerId = setInterval(() => {
      rv.recordSecondsLeft--;
      if (recordTimerBadge) {
        recordTimerBadge.textContent = `00:${rv.recordSecondsLeft.toString().padStart(2, '0')}`;
      }
      if (rv.recordSecondsLeft <= 0) {
        clearInterval(rv.recordTimerId);
        if (rv.mediaRecorder && rv.mediaRecorder.state !== 'inactive') rv.mediaRecorder.stop();
      }
    }, 1000);
  }

  stopRecordingBtn?.addEventListener('click', () => {
    if (rv.recordTimerId) clearInterval(rv.recordTimerId);
    if (rv.mediaRecorder && rv.mediaRecorder.state !== 'inactive') rv.mediaRecorder.stop();
  });

  exportBtn?.addEventListener('click', () => {
    const lines = [
      '=================================================================',
      '  INTERVIEWIQ : VIDEO MEETING & PRESENTATION COACHING SUMMARY    ',
      '=================================================================',
      `Generated: ${new Date().toLocaleString()}`,
      `Recording: ${videoNameBadge?.textContent || 'Session Recording'}`,
      `Duration : ${fmtTime(rv.videoDuration)}`,
      `Total Notes Pinned: ${rv.notes.length}`,
      '',
      '--- ETHICAL AI & VOLUNTARY PRACTICE CHARTER ---',
      'Notice: Expression metrics measure observable surface visual cues',
      '(facial steadiness, smiles, gaze stability), NOT a person\'s inner',
      'feelings, truthfulness, sincerity, or neurological state.',
      'Supports voluntary presentation practice and delivery calibration only.',
      '',
      '--- PINNED NOTES & SELF-ASSESSMENT ---',
    ];

    if (rv.notes.length === 0) {
      lines.push('No notes pinned during this playback session.');
    } else {
      [...rv.notes].sort((a, b) => a.time - b.time).forEach(n => {
        lines.push(`[${fmtTime(n.time)}] Rating: ${n.rating}/5 [${n.tag}] (${n.confidence} confidence)`);
        lines.push(`       "${n.text}"`);
      });
    }

    if (rv.expressionData.length > 0) {
      const avgComp = Math.round(rv.expressionData.reduce((a, d) => a + d.composure, 0) / rv.expressionData.length);
      const avgWarm = Math.round(rv.expressionData.reduce((a, d) => a + d.warmth, 0) / rv.expressionData.length);
      const avgTens = Math.round(rv.expressionData.reduce((a, d) => a + d.tension, 0) / rv.expressionData.length);

      lines.push('', '--- OBSERVABLE EXPRESSION METRICS ---');
      lines.push(`Average Visual Composure : ${avgComp}%`);
      lines.push(`Expressive Warmth / Smile: ${avgWarm}%`);
      lines.push(`Average Tension Cues     : ${avgTens}%`);

      if (rv.notes.length > 0) {
        const avgRating = (rv.notes.reduce((a, n) => a + (n.rating / 5) * 100, 0) / rv.notes.length).toFixed(1);
        lines.push('', '--- SELF-AWARENESS CALIBRATION ---');
        lines.push(`Subjective Self-Rating Avg: ${avgRating}%`);
        lines.push(`Detected Visual Composure : ${avgComp}%`);
        lines.push(`Calibration Alignment Gap : ${Math.abs(avgRating - avgComp).toFixed(1)}%`);
      }
    }

    lines.push('', '=================================================================');
    lines.push('End of Coaching Summary. Exported locally from browser session.');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presentation_Coaching_Summary_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  function escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

