// ============================================
// B HAN — Skin Camera Module
// Basic skin analysis via camera + pixel color detection
// Rule-based product suggestions
// ============================================
// Usage: Include this file after app.js
// Adds B.openSkinCam() method and #skin-cam-modal to the page

(function(){
  'use strict';

  // ─── SKIN ANALYSIS ENGINE ───
  const SkinEngine = {
    // Analyze pixel data from a canvas region
    analyze(imageData) {
      const d = imageData.data;
      const len = d.length;
      let rSum=0, gSum=0, bSum=0, count=0;
      let redness=0, brightness=0;
      const variations = [];

      // Sample every 4th pixel for performance
      for(let i=0; i<len; i+=16) {
        const r=d[i], g=d[i+1], b=d[i+2], a=d[i+3];
        if(a < 200) continue; // skip transparent

        // Basic skin color detection (HSL-based filtering)
        const max=Math.max(r,g,b), min=Math.min(r,g,b);
        const l=(max+min)/2/255;
        const s=max===min?0:(max-min)/(l>0.5?(510-max-min):(max+min));
        let h=0;
        if(max!==min){
          if(max===r) h=((g-b)/(max-min))%6;
          else if(max===g) h=(b-r)/(max-min)+2;
          else h=(r-g)/(max-min)+4;
          h=Math.round(h*60);if(h<0)h+=360;
        }

        // Skin tone hue range: roughly 0-50 (warm tones)
        const isSkin = (h>=0 && h<=50) && s>0.1 && s<0.85 && l>0.15 && l<0.85;
        if(!isSkin) continue;

        rSum+=r; gSum+=g; bSum+=b; count++;
        redness += (r-g)/255;
        brightness += l;
        variations.push(l);
      }

      if(count < 50) return null; // not enough skin pixels

      const avgR = rSum/count, avgG = gSum/count, avgB = bSum/count;
      const avgRedness = redness/count;
      const avgBrightness = brightness/count;

      // Texture variation (standard deviation of luminance)
      const avgL = avgBrightness;
      let varSum = 0;
      for(const v of variations) { varSum += (v-avgL)*(v-avgL); }
      const textureVar = Math.sqrt(varSum/variations.length);

      return {
        pixelCount: count,
        avgColor: { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) },
        redness: avgRedness,       // 0 = balanced, >0.15 = reddish
        brightness: avgBrightness, // 0-1, higher = lighter skin
        textureVar: textureVar,    // higher = more uneven texture
        oiliness: this._estimateOiliness(avgBrightness, textureVar),
        hydration: this._estimateHydration(avgBrightness, avgRedness, textureVar)
      };
    },

    _estimateOiliness(brightness, textureVar) {
      // Bright + low texture variance = potentially oily (shiny)
      if(brightness > 0.55 && textureVar < 0.08) return 'high';
      if(brightness > 0.45 && textureVar < 0.10) return 'medium';
      return 'low';
    },

    _estimateHydration(brightness, redness, textureVar) {
      // High texture variation + low brightness = dry
      if(textureVar > 0.12 && brightness < 0.45) return 'low';
      if(textureVar > 0.09) return 'medium';
      return 'good';
    },

    // Map analysis results to skin profile
    diagnose(analysis) {
      if(!analysis) return null;

      const result = {
        skinType: 'normal',
        concerns: [],
        score: 0,          // 0-100 skin health score
        tips: [],
        matchConcerns: []   // for product matching
      };

      // Determine skin type
      if(analysis.oiliness === 'high') {
        result.skinType = 'oily';
        result.concerns.push('Excess oil / shine detected');
        result.matchConcerns.push('acne', 'pores');
        result.tips.push('Use oil-free moisturizer', 'Try BHA toner for pore control');
      } else if(analysis.hydration === 'low') {
        result.skinType = 'dry';
        result.concerns.push('Low hydration detected');
        result.matchConcerns.push('dullness');
        result.tips.push('Layer hydrating essences', 'Use sleeping mask at night');
      } else if(analysis.oiliness === 'medium' && analysis.hydration === 'medium') {
        result.skinType = 'combo';
        result.concerns.push('Combination skin — oily T-zone, dry cheeks');
        result.matchConcerns.push('pores', 'dullness');
        result.tips.push('Use lighter products on T-zone', 'Rich cream on cheeks only');
      } else {
        result.skinType = 'normal';
        result.tips.push('Your skin looks balanced!', 'Maintain with SPF and hydration');
      }

      // Check redness
      if(analysis.redness > 0.15) {
        result.concerns.push('Redness / irritation detected');
        result.matchConcerns.push('sensitive');
        result.tips.push('Use centella or heartleaf products', 'Avoid harsh exfoliants');
      }

      // Check texture
      if(analysis.textureVar > 0.11) {
        result.concerns.push('Uneven texture detected');
        result.matchConcerns.push('pores', 'acne');
        result.tips.push('Try AHA/BHA exfoliation 2x/week', 'Consider snail mucin for repair');
      }

      // Check brightness for pigmentation
      if(analysis.brightness < 0.35) {
        result.concerns.push('Dullness / dark spots possible');
        result.matchConcerns.push('dullness', 'pigment');
        result.tips.push('Vitamin C serum in the morning', 'SPF is essential');
      }

      // Score (rough estimate)
      let score = 70;
      if(analysis.oiliness === 'high') score -= 10;
      if(analysis.hydration === 'low') score -= 15;
      if(analysis.redness > 0.15) score -= 10;
      if(analysis.textureVar > 0.11) score -= 10;
      if(analysis.hydration === 'good' && analysis.oiliness === 'low') score += 15;
      result.score = Math.max(20, Math.min(95, score));

      return result;
    },

    // Get product recommendations based on diagnosis
    recommend(diagnosis, products) {
      if(!diagnosis || !products || !products.length) return [];
      const concerns = diagnosis.matchConcerns || [];
      const skinType = diagnosis.skinType || '';

      return products
        .map(p => {
          const tags = ((p.tags||[]).concat(p.category||'',p.skinType||'',p.concern||'',p.notes||[]))
            .filter(Boolean).map(t => String(t).toLowerCase());
          let score = 0;
          if(skinType && tags.some(t => t.includes(skinType))) score += 3;
          concerns.forEach(c => { if(tags.some(t => t.includes(c))) score += 2; });
          if(p.featured) score += 1;
          return { p, score };
        })
        .filter(x => x.score > 0)
        .sort((a,b) => b.score - a.score)
        .slice(0, 6)
        .map(x => x.p);
    }
  };

  // ─── CAMERA UI ───
  let _stream = null;
  let _analysisResult = null;

  // Create modal if not exists
  function ensureModal() {
    if(document.getElementById('skin-cam-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'skin-cam-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:100%;width:100%;height:100vh;border-radius:0;background:var(--ink,#2a221a)">
        <div id="skin-cam-content"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function esc(s) { return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(n) { return '৳'+Number(n||0).toLocaleString('en-IN'); }
  function safeColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c||'')?c:'#e8e2d4'; }

  // Open skin scan — show choice: Camera or Upload
  window._skinCamOpen = async function() {
    ensureModal();
    document.getElementById('skin-cam-modal').classList.add('on');
    _analysisResult = null;
    _showChoiceScreen();
  };

  function _showChoiceScreen() {
    _stopStream(); // stop any active camera
    window._showChoiceScreen = _showChoiceScreen; // expose for onclick
    const content = document.getElementById('skin-cam-content');
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(180deg,#1a1610,#2a221a);color:#fff;padding:40px 24px;text-align:center">
        <div style="position:absolute;top:16px;right:16px">
          <button onclick="_skinCamClose()" style="width:36px;height:36px;border-radius:18px;background:rgba(255,255,255,.1);color:#fff;font-size:18px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <div style="font-size:48px;margin-bottom:18px;opacity:.8">✶</div>
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:30px;font-weight:500;line-height:1.05;margin-bottom:8px">Skin analysis</div>
        <div style="font-size:12.5px;color:rgba(255,255,255,.5);line-height:1.5;max-width:260px;margin-bottom:36px">Take a selfie or upload a photo — we'll analyze your skin and recommend products</div>

        <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:300px">
          <button onclick="_startCamera()" style="width:100%;padding:18px;border-radius:20px;background:linear-gradient(135deg,#c2724a,#d89a70);color:#fff;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 8px 24px rgba(194,114,74,.3)">
            <span style="font-size:20px">📷</span> Open camera
          </button>
          <button onclick="_triggerUpload()" style="width:100%;padding:18px;border-radius:20px;background:rgba(255,255,255,.08);color:#fff;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(255,255,255,.15);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px">
            <span style="font-size:20px">🖼️</span> Upload photo
          </button>
        </div>
        <div style="font-size:10.5px;color:rgba(255,255,255,.3);margin-top:24px;line-height:1.5;max-width:240px">Best results: clean face, good lighting, no makeup, close-up selfie</div>
        <input type="file" id="skin-upload-input" accept="image/*" style="display:none" onchange="_handleUpload(event)"/>
      </div>
    `;
  }

  // Trigger file upload
  window._triggerUpload = function() {
    const input = document.getElementById('skin-upload-input');
    if(input) input.click();
  };

  // Handle uploaded photo
  window._handleUpload = function(event) {
    const file = event.target.files && event.target.files[0];
    if(!file) return;

    const content = document.getElementById('skin-cam-content');
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1a1610;color:#fff">
        <div style="font-size:32px;margin-bottom:16px;animation:float 1.5s infinite">✶</div>
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:18px">Analyzing your skin...</div>
      </div>
    `;

    const img = new Image();
    const reader = new FileReader();
    reader.onload = function(e) {
      img.onload = function() {
        _analyzeImage(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Analyze an image (from upload or camera capture)
  function _analyzeImage(img) {
    const canvas = document.createElement('canvas');
    const w = Math.min(img.width, 640);
    const h = Math.round(w * img.height / img.width);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Extract center region
    const cx = Math.floor(w * 0.25);
    const cy = Math.floor(h * 0.15);
    const cw = Math.floor(w * 0.5);
    const ch = Math.floor(h * 0.55);
    const imageData = ctx.getImageData(cx, cy, cw, ch);

    const analysis = SkinEngine.analyze(imageData);
    const diagnosis = SkinEngine.diagnose(analysis);

    let products = [];
    try { products = (typeof State !== 'undefined' && State.products) ? State.products : []; } catch(e) {}
    const recs = diagnosis ? SkinEngine.recommend(diagnosis, products) : [];

    _analysisResult = { analysis, diagnosis, recs };
    _showResults(analysis, diagnosis, recs);
  }

  // Start live camera
  window._startCamera = async function() {
    const content = document.getElementById('skin-cam-content');
    content.innerHTML = `
      <div style="position:relative;width:100%;height:100vh;background:#1a1610;display:flex;flex-direction:column;align-items:center;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;z-index:10">
          <button onclick="_showChoiceScreen()" style="width:36px;height:36px;border-radius:18px;background:rgba(255,255,255,.15);color:#fff;font-size:14px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">←</button>
          <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:18px;color:#fff;font-weight:500">Skin scan</div>
          <button onclick="_skinCamClose()" style="width:36px;height:36px;border-radius:18px;background:rgba(255,255,255,.15);color:#fff;font-size:18px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <video id="skin-cam-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
        <div id="skin-cam-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
          <div style="width:220px;height:280px;border:2px solid rgba(255,255,255,.4);border-radius:50%;position:relative">
            <div style="position:absolute;bottom:-30px;left:0;right:0;text-align:center;font-size:12px;color:rgba(255,255,255,.7);font-weight:600;letter-spacing:.05em">Place your face here</div>
          </div>
        </div>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:24px 20px 40px;display:flex;flex-direction:column;align-items:center;gap:14px;z-index:10;background:linear-gradient(transparent,rgba(26,22,16,.9))">
          <button id="skin-cam-btn" onclick="_skinCamCapture()" style="width:72px;height:72px;border-radius:36px;background:rgba(255,255,255,.9);border:4px solid rgba(255,255,255,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.3)">
            <div style="width:56px;height:56px;border-radius:28px;background:linear-gradient(135deg,#c2724a,#d89a70)"></div>
          </button>
          <div style="font-size:11px;color:rgba(255,255,255,.5);letter-spacing:.08em;text-transform:uppercase">Tap to analyze</div>
        </div>
        <canvas id="skin-cam-canvas" style="display:none"></canvas>
      </div>
    `;

    // Start camera
    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:'user', width:{ideal:640}, height:{ideal:480} },
        audio: false
      });
      const video = document.getElementById('skin-cam-video');
      if(video) { video.srcObject = _stream; video.play(); }
    } catch(e) {
      // Camera failed — fall back to upload with message
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#fff;padding:40px;text-align:center;background:#1a1610">
          <div style="font-size:48px;margin-bottom:20px;opacity:.5">📷</div>
          <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:22px;margin-bottom:10px">Camera not available</div>
          <div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;max-width:280px;margin-bottom:24px">
            ${e.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'Your browser can\'t access the camera right now.'}<br/><br/>
            No worries — you can upload a selfie instead!
          </div>
          <button onclick="_triggerUpload()" style="padding:14px 28px;border-radius:999px;background:linear-gradient(135deg,#c2724a,#d89a70);color:#fff;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:none;cursor:pointer;box-shadow:0 6px 18px rgba(194,114,74,.3)">🖼️ Upload selfie instead</button>
          <button onclick="_showChoiceScreen()" style="margin-top:14px;padding:12px 24px;border-radius:999px;background:rgba(255,255,255,.1);color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer">← Go back</button>
          <input type="file" id="skin-upload-input" accept="image/*" style="display:none" onchange="_handleUpload(event)"/>
        </div>
      `;
    }
  };

  // Capture from live camera and analyze
  window._skinCamCapture = function() {
    const video = document.getElementById('skin-cam-video');
    const canvas = document.getElementById('skin-cam-canvas');
    if(!video || !canvas) return;

    // Show analyzing state
    const btn = document.getElementById('skin-cam-btn');
    if(btn) btn.innerHTML = '<div style="width:56px;height:56px;border-radius:28px;background:rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700;letter-spacing:.08em">...</div>';

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    // Stop camera
    _stopStream();

    // Create image from canvas and analyze
    const img = new Image();
    img.onload = function() { _analyzeImage(img); };
    img.src = canvas.toDataURL('image/jpeg', 0.8);
  };

  function _stopStream() {
    if(_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
  }

  // Close camera
  window._skinCamClose = function() {
    _stopStream();
    const modal = document.getElementById('skin-cam-modal');
    if(modal) modal.classList.remove('on');
  };

  // Show results
  function _showResults(analysis, diagnosis, recs) {
    const content = document.getElementById('skin-cam-content');
    if(!content) return;

    if(!diagnosis) {
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#fff;padding:40px;text-align:center">
          <div style="font-size:48px;margin-bottom:20px">🤔</div>
          <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:22px;margin-bottom:10px">Couldn't detect skin</div>
          <div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;max-width:260px;margin-bottom:24px">Make sure your face is well-lit and centered in the oval guide. Avoid backlighting.</div>
          <button onclick="_skinCamOpen()" style="padding:12px 24px;border-radius:999px;background:rgba(255,255,255,.15);color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer;letter-spacing:.08em;text-transform:uppercase">Try again</button>
        </div>
      `;
      return;
    }

    const d = diagnosis;
    const scoreColor = d.score >= 70 ? '#7a8a5a' : d.score >= 50 ? '#c2724a' : '#8a3324';
    const typeLabel = { oily:'Oily', dry:'Dry', combo:'Combination', normal:'Normal' }[d.skinType] || 'Normal';
    const typeEmoji = { oily:'💧', dry:'🌵', combo:'🌗', normal:'✨' }[d.skinType] || '✨';

    const concernsHTML = d.concerns.length
      ? d.concerns.map(c => `<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span style="font-size:14px">⚠</span><span style="font-size:12.5px;color:rgba(255,255,255,.75)">${esc(c)}</span></div>`).join('')
      : '<div style="padding:10px 0;font-size:12.5px;color:rgba(255,255,255,.5)">No major concerns detected ✨</div>';

    const tipsHTML = d.tips.map(t =>
      `<div style="display:flex;align-items:start;gap:8px;padding:8px 0"><span style="color:#c2724a;font-size:12px;margin-top:2px">✶</span><span style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.5">${esc(t)}</span></div>`
    ).join('');

    const recsHTML = recs.length
      ? `<div style="margin-top:20px">
          <div style="font-size:9.5px;letter-spacing:.3em;text-transform:uppercase;font-weight:700;color:#c2724a;margin-bottom:12px">Recommended for you</div>
          <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none">
            ${recs.map(p => `
              <div onclick="B.go('product',{product:'${esc(p.id)}'});_skinCamClose()" style="flex:0 0 130px;cursor:pointer">
                <div style="height:100px;border-radius:14px;background:${safeColor(p.glassHue)};display:flex;align-items:center;justify-content:center;font-size:28px;opacity:.6">✶</div>
                <div style="margin-top:8px;font-family:'Cormorant Garamond',serif;font-size:13px;font-style:italic;font-weight:500;color:#fff;line-height:1.2;min-height:30px">${esc(p.name)}</div>
                <div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-top:2px">${esc(p.brand||'')}</div>
                <div style="font-size:13px;font-weight:700;color:#c2724a;margin-top:4px;font-family:'Cormorant Garamond',serif">${fmt(p.price)}</div>
              </div>
            `).join('')}
          </div>
        </div>`
      : '';

    content.innerHTML = `
      <div style="min-height:100vh;background:linear-gradient(180deg,#1a1610 0%,#2a221a 100%);color:#fff;overflow-y:auto;padding-bottom:40px">
        <div style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
          <button onclick="_skinCamClose()" style="width:36px;height:36px;border-radius:18px;background:rgba(255,255,255,.1);color:#fff;font-size:18px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
          <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:18px;font-weight:500">Your results</div>
          <div style="width:36px"></div>
        </div>

        <!-- Score circle -->
        <div style="display:flex;flex-direction:column;align-items:center;padding:24px 0 20px">
          <div style="width:120px;height:120px;border-radius:60px;border:3px solid ${scoreColor};display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative">
            <div style="font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:600;line-height:1">${d.score}</div>
            <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.5)">Skin score</div>
          </div>
          <div style="margin-top:16px;display:flex;align-items:center;gap:8px">
            <span style="font-size:22px">${typeEmoji}</span>
            <span style="font-family:'Cormorant Garamond',serif;font-size:26px;font-style:italic;font-weight:500">${esc(typeLabel)} Skin</span>
          </div>
        </div>

        <div style="padding:0 20px">
          <!-- Concerns -->
          <div style="background:rgba(255,255,255,.05);border-radius:18px;padding:16px;margin-bottom:14px">
            <div style="font-size:9.5px;letter-spacing:.3em;text-transform:uppercase;font-weight:700;color:#c2724a;margin-bottom:8px">What we found</div>
            ${concernsHTML}
          </div>

          <!-- Tips -->
          <div style="background:rgba(255,255,255,.05);border-radius:18px;padding:16px;margin-bottom:14px">
            <div style="font-size:9.5px;letter-spacing:.3em;text-transform:uppercase;font-weight:700;color:#c2724a;margin-bottom:8px">Your ritual tips</div>
            ${tipsHTML}
          </div>

          <!-- Color analysis (mini) -->
          <div style="display:flex;gap:10px;margin-bottom:14px">
            <div style="flex:1;background:rgba(255,255,255,.05);border-radius:14px;padding:14px;text-align:center">
              <div style="width:28px;height:28px;border-radius:14px;background:rgb(${analysis.avgColor.r},${analysis.avgColor.g},${analysis.avgColor.b});margin:0 auto 8px;border:2px solid rgba(255,255,255,.2)"></div>
              <div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.4)">Tone</div>
            </div>
            <div style="flex:1;background:rgba(255,255,255,.05);border-radius:14px;padding:14px;text-align:center">
              <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;margin-bottom:4px">${analysis.redness > 0.15 ? 'High' : analysis.redness > 0.08 ? 'Med' : 'Low'}</div>
              <div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.4)">Redness</div>
            </div>
            <div style="flex:1;background:rgba(255,255,255,.05);border-radius:14px;padding:14px;text-align:center">
              <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;margin-bottom:4px">${analysis.oiliness === 'high' ? 'High' : analysis.oiliness === 'medium' ? 'Med' : 'Low'}</div>
              <div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.4)">Oiliness</div>
            </div>
          </div>

          ${recsHTML}

          <!-- Actions -->
          <div style="display:flex;gap:10px;margin-top:20px">
            <button onclick="_skinCamOpen()" style="flex:1;padding:14px;border-radius:999px;background:rgba(255,255,255,.1);color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:none;cursor:pointer">Scan again</button>
            <button onclick="_skinCamSave();_skinCamClose()" style="flex:1;padding:14px;border-radius:999px;background:linear-gradient(135deg,#c2724a,#d89a70);color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:none;cursor:pointer;box-shadow:0 6px 18px rgba(194,114,74,.3)">Save & shop →</button>
          </div>
        </div>
      </div>
    `;
  }

  // Save skin profile from camera results
  window._skinCamSave = function() {
    if(!_analysisResult || !_analysisResult.diagnosis) return;
    const d = _analysisResult.diagnosis;
    const profile = {
      skinType: d.skinType,
      concerns: d.matchConcerns || [],
      goal: d.score >= 70 ? 'glow' : 'clear',
      source: 'camera',
      score: d.score,
      analyzedAt: Date.now()
    };
    if(typeof Store !== 'undefined') {
      Store.saveSkinProfile(profile);
    }
    if(typeof State !== 'undefined') {
      State.skinProfile = profile;
      State.recommendations = (typeof Store !== 'undefined')
        ? Store.recommendForProfile(profile, State.products)
        : [];
    }
    if(typeof render === 'function') render();
    if(typeof toast === 'function') toast('✶ Skin profile saved from scan!', 'ok');
  };

  // Expose to B object
  if(typeof window.B !== 'undefined') {
    window.B.openSkinCam = function() {
      if(window.B._closeAllModals) window.B._closeAllModals();
      _skinCamOpen();
    };
  } else {
    // B not loaded yet — set up when ready
    document.addEventListener('DOMContentLoaded', function() {
      if(window.B) {
        window.B.openSkinCam = function() {
          if(window.B._closeAllModals) window.B._closeAllModals();
          _skinCamOpen();
        };
      }
    });
  }

})();
