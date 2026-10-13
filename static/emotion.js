/**
 * InterviewIQ - Multimodal Emotion Analysis
 * Real-time facial expression (face-api) + voice prosody (Web Audio API)
 */
'use strict';

const EmotionEngine = {
  modelsLoaded: false,
  modelsLoading: false,
  detectInterval: null,
  voiceInterval: null,
  audioContext: null,
  analyser: null,
  facialSamples: [],
  voiceSamples: [],
  latestFacial: null,
  latestVoice: null,
  MODEL_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
};

async function loadEmotionModels() {
  if (EmotionEngine.modelsLoaded || EmotionEngine.modelsLoading) return EmotionEngine.modelsLoaded;
  if (typeof faceapi === 'undefined') return false;
  EmotionEngine.modelsLoading = true;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(EmotionEngine.MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(EmotionEngine.MODEL_URL),
    ]);
    EmotionEngine.modelsLoaded = true;
    return true;
  } catch (e) {
    console.error('Failed to load face models:', e);
    return false;
  } finally {
    EmotionEngine.modelsLoading = false;
  }
}

async function startCamera() {
  const video = document.getElementById('webcam');
  const wrapper = document.getElementById('video-wrapper');
  const placeholder = document.getElementById('video-placeholder');
  const enableBtn = document.getElementById('enable-camera-btn');

  if (!video || !navigator.mediaDevices?.getUserMedia) {
    showCameraError('Camera not supported. Use Chrome or Edge.');
    return false;
  }

  try {
    if (Session.stream) stopCamera();

    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    Session.stream = videoStream;
    video.srcObject = videoStream;
    video.setAttribute('playsinline', '');
    video.muted = true;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
      setTimeout(() => reject(new Error('Camera timeout')), 8000);
    });

    wrapper?.classList.add('cam-active');
    if (placeholder) placeholder.style.display = 'none';
    if (enableBtn) enableBtn.style.display = 'none';

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioStream.getAudioTracks().forEach(t => Session.stream.addTrack(t));
      initVoiceAnalysis(audioStream);
    } catch (e) {
      console.warn('Microphone unavailable:', e);
      updateVoiceStatus('Mic unavailable');
    }

    await loadEmotionModels();
    startFaceDetection();
    return true;
  } catch (e) {
    const msg = e.name === 'NotAllowedError'
      ? 'Camera permission denied. Click Enable Camera and allow access.'
      : 'Camera error: ' + e.message;
    showCameraError(msg);
    return false;
  }
}

function showCameraError(msg) {
  const placeholder = document.getElementById('video-placeholder');
  const enableBtn = document.getElementById('enable-camera-btn');
  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.innerHTML = '<p class="cam-error-text">' + msg + '</p>';
  }
  if (enableBtn) enableBtn.style.display = 'inline-flex';
}

function stopCamera() {
  clearInterval(EmotionEngine.detectInterval);
  clearInterval(EmotionEngine.voiceInterval);
  EmotionEngine.detectInterval = null;
  EmotionEngine.voiceInterval = null;
  if (EmotionEngine.audioContext) {
    EmotionEngine.audioContext.close().catch(function(){});
    EmotionEngine.audioContext = null;
  }
  EmotionEngine.analyser = null;
  if (Session.stream) {
    Session.stream.getTracks().forEach(function(t){ t.stop(); });
    Session.stream = null;
  }
  var video = document.getElementById('webcam');
  if (video) video.srcObject = null;
  document.getElementById('video-wrapper')?.classList.remove('cam-active');
}

function startFaceDetection() {
  clearInterval(EmotionEngine.detectInterval);
  EmotionEngine.detectInterval = setInterval(detectFaceFrame, 180);
}

async function detectFaceFrame() {
  var video = document.getElementById('webcam');
  var canvas = document.getElementById('face-canvas');
  if (!video || !canvas || video.readyState < 2) return;
  if (!document.getElementById('interview-page')?.classList.contains('active')) return;

  canvas.width = video.videoWidth || video.offsetWidth || 640;
  canvas.height = video.videoHeight || video.offsetHeight || 480;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!EmotionEngine.modelsLoaded) {
    drawScanOverlay(ctx, canvas.width, canvas.height, null);
    return;
  }

  try {
    var detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
      .withFaceExpressions();

    if (detection) {
      drawScanOverlay(ctx, canvas.width, canvas.height, detection.detection.box);
      var expr = detection.expressions;
      EmotionEngine.latestFacial = {
        happy: expr.happy, neutral: expr.neutral, surprised: expr.surprised,
        fearful: expr.fearful, sad: expr.sad, angry: expr.angry, disgusted: expr.disgusted,
      };
      EmotionEngine.facialSamples.push(Object.assign({}, EmotionEngine.latestFacial, { t: Date.now() }));
      if (EmotionEngine.facialSamples.length > 200) EmotionEngine.facialSamples.shift();
      updateFacialUI(EmotionEngine.latestFacial);
    } else {
      drawScanOverlay(ctx, canvas.width, canvas.height, null);
    }
  } catch (e) {
    console.warn('Face detection error:', e);
  }
}

function drawScanOverlay(ctx, w, h, box) {
  ctx.strokeStyle = 'rgba(244, 241, 234, 0.7)';
  ctx.lineWidth = 1.5;
  if (box) {
    var pad = 8;
    ctx.strokeRect(box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2);
  } else {
    var cx = w / 2, cy = h / 2, fw = w * 0.38, fh = h * 0.52;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cx - fw / 2, cy - fh / 2, fw, fh);
    ctx.setLineDash([]);
  }
}

function mapFacialToBars(expr) {
  return {
    happy: (expr.happy || 0) * 100,
    neutral: (expr.neutral || 0) * 100,
    anxious: ((expr.fearful || 0) + (expr.sad || 0) * 0.6) * 100,
    thoughtful: (expr.neutral * 0.4 + expr.surprised * 0.3) * 100,
    surprised: (expr.surprised || 0) * 100,
    stressed: ((expr.angry || 0) + (expr.disgusted || 0) * 0.5) * 100,
  };
}

function updateFacialUI(expr) {
  var bars = mapFacialToBars(expr);
  Object.keys(bars).forEach(function(k) {
    var pct = Math.round(Math.min(100, bars[k]));
    var fill = document.getElementById('bar-' + k);
    var val = document.getElementById('val-' + k);
    if (fill) fill.style.width = pct + '%';
    if (val) val.textContent = pct + '%';
    Session.dominantEmotions[k] = (Session.dominantEmotions[k] || 0) * 0.7 + pct * 0.3;
  });
  var dominant = Object.entries(bars).sort(function(a, b){ return b[1] - a[1]; })[0];
  var statusEl = document.getElementById('facial-status');
  if (statusEl) statusEl.textContent = dominant[0].charAt(0).toUpperCase() + dominant[0].slice(1);
}

function initVoiceAnalysis(audioStream) {
  try {
    EmotionEngine.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    var source = EmotionEngine.audioContext.createMediaStreamSource(audioStream);
    EmotionEngine.analyser = EmotionEngine.audioContext.createAnalyser();
    EmotionEngine.analyser.fftSize = 2048;
    EmotionEngine.analyser.smoothingTimeConstant = 0.82;
    source.connect(EmotionEngine.analyser);
    EmotionEngine.voiceInterval = setInterval(analyzeVoiceFrame, 250);
    updateVoiceStatus('Active');
  } catch (e) {
    updateVoiceStatus('Unavailable');
  }
}

function analyzeVoiceFrame() {
  if (!EmotionEngine.analyser) return;
  var buf = new Float32Array(EmotionEngine.analyser.fftSize);
  EmotionEngine.analyser.getFloatTimeDomainData(buf);
  var sum = 0, crossings = 0;
  for (var i = 0; i < buf.length; i++) {
    sum += buf[i] * buf[i];
    if (i > 0 && ((buf[i] >= 0) !== (buf[i - 1] >= 0))) crossings++;
  }
  var rms = Math.sqrt(sum / buf.length);
  var volume = Math.min(100, rms * 800);
  var pitchProxy = crossings / buf.length * 1000;
  EmotionEngine._volHistory = EmotionEngine._volHistory || [];
  EmotionEngine._volHistory.push(volume);
  if (EmotionEngine._volHistory.length > 20) EmotionEngine._volHistory.shift();
  var mean = EmotionEngine._volHistory.reduce(function(a, b){ return a + b; }, 0) / EmotionEngine._volHistory.length;
  var variance = EmotionEngine._volHistory.reduce(function(s, v){ return s + Math.pow(v - mean, 2); }, 0) / EmotionEngine._volHistory.length;
  var nervousness = Math.min(100, Math.round(variance * 2 + (pitchProxy > 180 ? 15 : 0)));
  var confidence = Math.min(100, Math.round(50 + volume * 0.35 - nervousness * 0.25));
  var energy = Math.min(100, Math.round(volume * 0.9));
  var clarity = Math.min(100, Math.round(60 + volume * 0.3 - variance * 0.5));
  var pace = pitchProxy > 200 ? 'fast' : pitchProxy < 80 ? 'slow' : 'moderate';
  EmotionEngine.latestVoice = { confidence: confidence, energy: energy, nervousness: nervousness, clarity: clarity, pace: pace };
  EmotionEngine.voiceSamples.push(Object.assign({}, EmotionEngine.latestVoice, { t: Date.now() }));
  if (EmotionEngine.voiceSamples.length > 200) EmotionEngine.voiceSamples.shift();
  updateVoiceUI(EmotionEngine.latestVoice);
}

function updateVoiceUI(v) {
  setText('mm-confidence', v.confidence + '%');
  setText('mm-voice-energy', v.energy + '%');
  setText('mm-voice-stress', v.nervousness + '%');
  setText('voice-dominant', v.confidence >= 65 ? 'Confident' : v.nervousness >= 55 ? 'Tense' : 'Composed');
  setBar('bar-voice-conf', v.confidence);
  setBar('bar-voice-energy', v.energy);
  setBar('bar-voice-stress', v.nervousness);
}

function updateVoiceStatus(text) {
  var el = document.getElementById('voice-analysis-status');
  if (el) el.textContent = text;
}

function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
function setBar(id, pct) { var el = document.getElementById(id); if (el) el.style.width = Math.round(pct) + '%'; }

function resetEmotionSamples() {
  EmotionEngine.facialSamples = [];
  EmotionEngine.voiceSamples = [];
  EmotionEngine.latestFacial = null;
  EmotionEngine.latestVoice = null;
  EmotionEngine._volHistory = [];
}

function averageFacialSamples() {
  if (!EmotionEngine.facialSamples.length) return null;
  var keys = ['happy', 'neutral', 'surprised', 'fearful', 'sad', 'angry', 'disgusted'];
  var avg = {};
  keys.forEach(function(k) {
    avg[k] = EmotionEngine.facialSamples.reduce(function(s, f){ return s + (f[k] || 0); }, 0) / EmotionEngine.facialSamples.length;
  });
  return avg;
}

function averageVoiceSamples() {
  if (!EmotionEngine.voiceSamples.length) return null;
  var keys = ['confidence', 'energy', 'nervousness', 'clarity'];
  var avg = {};
  keys.forEach(function(k) {
    avg[k] = Math.round(EmotionEngine.voiceSamples.reduce(function(s, v){ return s + (v[k] || 0); }, 0) / EmotionEngine.voiceSamples.length);
  });
  var paces = EmotionEngine.voiceSamples.map(function(v){ return v.pace; });
  avg.pace = paces.sort(function(a, b){ return paces.filter(function(p){ return p === b; }).length - paces.filter(function(p){ return p === a; }).length; })[0] || 'moderate';
  return avg;
}

function getCurrentBiometricsPayload() {
  return {
    facial: averageFacialSamples() || EmotionEngine.latestFacial,
    voice: averageVoiceSamples() || EmotionEngine.latestVoice,
  };
}

function initCameraControls() {
  document.getElementById('enable-camera-btn')?.addEventListener('click', function(){ startCamera(); });
}

function startEmotionTracking() {
  resetEmotionSamples();
  if (Session.stream) startFaceDetection();
}

function stopEmotionTracking() {
  clearInterval(EmotionEngine.detectInterval);
  clearInterval(EmotionEngine.voiceInterval);
}
