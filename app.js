// ============================================
// B HAN — Customer App · Soft Seoul Edition
// State + render() + window.B
// ============================================

const State = {
  page:'home', category:'All', search:'', cart:[], products:[], settings:{...STORE_DEFAULTS},
  loading:true, selectedProduct:null, payment:'cod',
  customer:{name:'',phone:'',address:'',area:'inside'},
  coupon:null, skinProfile:null, recommendations:[], trackOrder:null, trackError:'',
  user:null, authMode:'login', authErr:''
};

const QUIZ_STEPS = [
  {key:'skinType',q:'What is your skin type?',opts:[
    {v:'oily',label:'Oily 💧'},{v:'dry',label:'Dry 🌵'},{v:'combo',label:'Combination 🌗'},{v:'normal',label:'Normal ✨'}
  ]},
  {key:'concerns',q:'Top concerns? (pick all)',multi:true,opts:[
    {v:'acne',label:'Acne'},{v:'dullness',label:'Dullness'},{v:'aging',label:'Anti-aging'},{v:'pores',label:'Pores'},{v:'pigment',label:'Dark Spots'},{v:'sensitive',label:'Sensitive'}
  ]},
  {key:'goal',q:'Your beauty goal?',opts:[
    {v:'glass',label:'Glass Skin ✨'},{v:'glow',label:'Glow Up 🌟'},{v:'clear',label:'Clear Skin 🪞'},{v:'youthful',label:'Youthful 🌸'}
  ]}
];

// ─── Helpers ───
function fmt(n){return '৳'+Number(n||0).toLocaleString('en-IN')}
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function safeColor(c){return /^#[0-9a-fA-F]{3,8}$/.test(c||'')?c:'#e8e2d4'} // only allow hex colors
function toast(msg,type){
  const h=$('toast-host');if(!h)return;h.innerHTML='';
  const t=document.createElement('div');t.className='toast '+(type||'');t.textContent=msg;h.appendChild(t);
  setTimeout(()=>{try{h.removeChild(t)}catch(e){}},2500);
}

// ─── B (public API) ───
const B = {
  go(page,opts){
    State.page=page;
    if(page!=='orders')State._myOrdersLoaded=false;
    if(opts&&opts.product)State.selectedProduct=opts.product;
    if(opts&&opts.category)State.category=opts.category;
    // History integration: Android back button walks back through pages instead of closing the app
    try{
      const st={page,product:State.selectedProduct,category:State.category};
      if(history.state&&history.state.page===page&&history.state.product===State.selectedProduct){
        history.replaceState(st,'');
      }else{
        history.pushState(st,'');
      }
    }catch(e){}
    window.scrollTo({top:0,behavior:'instant'});var _ap=document.getElementById('app');if(_ap)_ap.scrollTop=0;render();
  },
  setSearch(v){
    State.search=v;
    // Only re-render product list to preserve search input focus + cursor position
    if(State.page==='products'){
      const prodsContainer=document.querySelector('.prods');
      const cats=['All',...(State.settings.categories||[])];
      const q=(v||'').toLowerCase();
      let list=State.products.slice();
      if(State.category&&State.category!=='All')list=list.filter(p=>(p.category||'').toLowerCase()===State.category.toLowerCase());
      if(q)list=list.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q)||(p.brand||'').toLowerCase().includes(q));
      if(prodsContainer){
        prodsContainer.innerHTML=list.length?list.map(pcardHTML).join(''):'<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted);font-family:var(--serif);font-style:italic">No products found</div>';
        const subEl=document.querySelector('.sec-sub');
        if(subEl)subEl.textContent=list.length+' products';
        return;
      }
    }
    render();
  },
  setCategory(c){State.category=c;render()},

  // Auth
  _closeAllModals(){
    ['auth-modal','quiz-modal','track-modal'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('on')});
  },
  // History helpers: pressing Android back closes an open modal instead of leaving the app
  _pushModal(name){
    try{
      const cur=history.state||{page:State.page};
      if(!cur.modal)history.pushState({...cur,modal:name},'');
    }catch(e){}
  },
  _popModal(){
    try{
      if(history.state&&history.state.modal){window._suppressPop=true;history.back();}
    }catch(e){}
  },
  openAuth(mode){
    this._closeAllModals();
    State.authMode=mode||'login';State.authErr='';
    document.getElementById('auth-modal').classList.add('on');
    this._pushModal('auth');
    document.getElementById('auth-modal-title').textContent=
      mode==='register'?'Create account':mode==='forgot'?'Reset password':'Welcome back';
    this._renderAuth();
  },
  closeAuth(){document.getElementById('auth-modal').classList.remove('on');this._popModal()},
  switchAuth(mode){State.authMode=mode;State.authErr='';
    document.getElementById('auth-modal-title').textContent=
      mode==='register'?'Create account':mode==='forgot'?'Reset password':'Welcome back';
    this._renderAuth()},
  _renderAuth(){
    const m=State.authMode,e=State.authErr;
    let h='';
    if(m==='login'){
      h=`<div class="auth-card">
        <div class="auth-title">Sign in</div>
        <div class="auth-sub">Enter your email and password</div>
        ${e?`<div class="auth-err">${esc(e)}</div>`:''}
        <input class="auth-input" id="auth-email" type="email" placeholder="your@email.com" onkeydown="if(event.key==='Enter')document.getElementById('auth-pw').focus()"/>
        <input class="auth-input" id="auth-pw" type="password" placeholder="Password" onkeydown="if(event.key==='Enter')B.doLogin()"/>
        <button class="auth-btn" onclick="B.doLogin()">Sign in →</button>
        <div class="auth-switch"><a onclick="B.switchAuth('forgot')">Forgot password?</a></div>
        <div class="auth-switch">New here? <a onclick="B.switchAuth('register')">Create account</a></div>
      </div>`;
    } else if(m==='register'){
      h=`<div class="auth-card">
        <div class="auth-title">Create account</div>
        <div class="auth-sub">We'll send a verification email</div>
        ${e?`<div class="auth-err">${esc(e)}</div>`:''}
        <input class="auth-input" id="auth-name" placeholder="Full name"/>
        <input class="auth-input" id="auth-email" type="email" placeholder="your@email.com"/>
        <input class="auth-input" id="auth-phone" type="tel" placeholder="BD phone: 01XXXXXXXXX"/>
        <input class="auth-input" id="auth-pw" type="password" placeholder="Password (min 6 chars)" onkeydown="if(event.key==='Enter')B.doRegister()"/>
        <button class="auth-btn" onclick="B.doRegister()">Create account →</button>
        <div class="auth-switch">Already have an account? <a onclick="B.switchAuth('login')">Sign in</a></div>
      </div>`;
    } else if(m==='forgot'){
      h=`<div class="auth-card">
        <div class="auth-title">Reset password</div>
        <div class="auth-sub">We'll email you a reset link</div>
        ${e?`<div class="auth-err">${esc(e)}</div>`:''}
        <input class="auth-input" id="auth-email" type="email" placeholder="your@email.com" onkeydown="if(event.key==='Enter')B.doReset()"/>
        <button class="auth-btn" onclick="B.doReset()">Send reset link →</button>
        <div class="auth-switch"><a onclick="B.switchAuth('login')">Back to sign in</a></div>
      </div>`;
    }
    document.getElementById('auth-body').innerHTML=h;
    setTimeout(()=>{const f=document.getElementById(m==='register'?'auth-name':'auth-email');if(f)f.focus()},100);
  },
  async doLogin(){
    const email=(document.getElementById('auth-email').value||'').trim();
    const pw=(document.getElementById('auth-pw').value||'').trim();
    try{
      const user=await Store.login(email,pw);
      State.user=user;
      State.customer={name:user.name||'',phone:user.phone||'',address:user.address||'',area:user.area||'inside'};
      this.closeAuth();
      toast('Welcome back'+(user.name?', '+user.name.split(' ')[0]:''),'ok');
      render();
    }catch(e){State.authErr=e.message;this._renderAuth()}
  },
  async doRegister(){
    const name=(document.getElementById('auth-name').value||'').trim();
    const email=(document.getElementById('auth-email').value||'').trim();
    const phone=(document.getElementById('auth-phone').value||'').trim();
    const pw=(document.getElementById('auth-pw').value||'').trim();
    try{
      const user=await Store.register(email,pw,name,phone);
      State.user=user;
      State.customer={name:user.name||'',phone:user.phone||'',address:'',area:'inside'};
      this.closeAuth();
      toast('✶ Account created! Check your email to verify.','ok');
      render();
    }catch(e){State.authErr=e.message;this._renderAuth()}
  },
  async doReset(){
    const email=(document.getElementById('auth-email').value||'').trim();
    try{
      await Store.resetPassword(email);
      State.authErr='';
      document.getElementById('auth-body').innerHTML=`<div class="auth-card"><div style="text-align:center;padding:20px 0"><div style="font-size:40px;margin-bottom:12px">✉️</div><div class="auth-title">Check your email</div><div class="auth-sub" style="margin-top:8px">We sent a reset link to <strong>${esc(email)}</strong></div><button class="auth-btn" style="margin-top:20px" onclick="B.switchAuth('login')">Back to sign in</button></div></div>`;
    }catch(e){State.authErr=e.message;this._renderAuth()}
  },
  async doLogout(){
    await Store.logout();State.user=null;State.customer={name:'',phone:'',address:'',area:'inside'};
    toast('Signed out','');render();
  },
  async resendVerify(){
    try{
      await Store.resendVerification();
      toast('✶ Verification email sent!','ok');
    }catch(e){toast(e.message,'err')}
  },
  async refreshVerify(){
    try{
      const verified=await Store.checkVerification();
      if(verified){if(State.user)State.user.emailVerified=true;toast('✶ Email verified!','ok');render()}
      else{toast('Not verified yet — check your inbox','err')}
    }catch(e){toast('Check failed','err')}
  },
  async saveProfile(){
    const name=(document.getElementById('prof-name').value||'').trim();
    const phone=(document.getElementById('prof-phone').value||'').trim();
    const address=(document.getElementById('prof-addr').value||'').trim();
    const area=State.customer.area;
    try{
      const updated=await Store.updateProfile({name,phone,address,area});
      State.user=updated;State.customer={...State.customer,name:updated.name||name,phone:updated.phone||phone,address:updated.address||address,area};
      toast('✶ Profile saved','ok');B.go('home');
    }catch(e){toast(e.message,'err')}
  },

  // Cart
  addToCart(pid,qty){
    const p=State.products.find(x=>x.id===pid);if(!p)return;
    const ex=State.cart.find(c=>c.id===p.id);
    if(ex)ex.qty+=(qty||1);
    else State.cart.push({id:p.id,name:p.name,price:p.price,qty:qty||1,image:p.image||'',category:p.category||'',brand:p.brand||'',glassHue:p.glassHue||''});
    this._saveCart();toast('Added — '+p.name,'ok');render();
  },
  changeQty(id,d){const it=State.cart.find(c=>c.id===id);if(!it)return;it.qty+=d;if(it.qty<=0)State.cart=State.cart.filter(c=>c.id!==id);this._saveCart();render()},
  removeFromCart(id){State.cart=State.cart.filter(c=>c.id!==id);this._saveCart();render()},
  _saveCart(){try{localStorage.setItem('bhan_cart',JSON.stringify(State.cart))}catch(e){}},

  // Coupon
  async applyCoupon(code){
    code=(code||'').trim().toUpperCase();
    if(!code){State.coupon=null;render();return}
    const coupons=await Store.getCoupons();
    const found=coupons.find(c=>(c.code||'').toUpperCase()===code&&c.active!==false);
    if(!found){toast('Invalid coupon','err');State.coupon=null;render();return}
    State.coupon=found;toast('✶ Coupon applied — '+found.code,'ok');render();
  },

  // Customer
  setCustomer(f,v){State.customer[f]=v;if(f==='area')render()},
  setPayment(m){State.payment=m;render()},

  // Quiz
  openQuiz(){this._closeAllModals();State._qs=0;State._qa={};$('quiz-modal').classList.add('on');this._pushModal('quiz');this._renderQuiz()},
  closeQuiz(){$('quiz-modal').classList.remove('on');this._popModal()},
  _renderQuiz(){
    const step=QUIZ_STEPS[State._qs],total=QUIZ_STEPS.length,isLast=State._qs===total-1,ans=State._qa[step.key];
    const optsH=step.opts.map(o=>{
      const on=step.multi?Array.isArray(ans)&&ans.indexOf(o.v)>=0:ans===o.v;
      return `<button class="q-opt ${on?'on':''}" onclick="B.pickQ('${step.key}','${o.v}',${step.multi?'true':'false'})">${esc(o.label)}</button>`;
    }).join('');
    const hasAns=step.multi?(Array.isArray(ans)&&ans.length>0):!!ans;
    $('quiz-body').innerHTML=`
      <div style="font-size:9.5px;letter-spacing:.3em;text-transform:uppercase;font-weight:700;color:var(--clay);margin-bottom:8px">Step ${State._qs+1} of ${total}</div>
      <div class="quiz-q"><h4>${esc(step.q)}</h4><div class="q-opts">${optsH}</div></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        ${State._qs>0?'<button class="btn-outline" style="flex:1" onclick="B.quizBack()">← Back</button>':''}
        <button class="btn-ink" style="flex:1;justify-content:center;${!hasAns?'opacity:.4;pointer-events:none':''}" onclick="B.quizNext()">${isLast?'See results →':'Next →'}</button>
      </div>`;
  },
  pickQ(key,val,multi){
    if(multi){const a=State._qa[key]||[];const i=a.indexOf(val);if(i>=0)a.splice(i,1);else a.push(val);State._qa[key]=a}
    else State._qa[key]=val;
    this._renderQuiz();
  },
  quizBack(){if(State._qs>0)State._qs--;this._renderQuiz()},
  quizNext(){
    if(State._qs<QUIZ_STEPS.length-1){State._qs++;this._renderQuiz()}
    else{const p={...State._qa};Store.saveSkinProfile(p);State.skinProfile=p;State.recommendations=Store.recommendForProfile(p,State.products);this.closeQuiz();toast('✶ Your matches are ready','ok');render()}
  },
  retakeQuiz(){Store.clearSkinProfile();State.skinProfile=null;State.recommendations=[];this.openQuiz()},

  // Track
  zoomImg(url){
    if(!url)return;
    let lb=document.getElementById('img-lightbox');
    if(!lb){lb=document.createElement('div');lb.id='img-lightbox';lb.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,20,17,.94);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out';lb.onclick=()=>lb.remove();document.body.appendChild(lb);}
    lb.innerHTML='<img src="'+url.replace(/"/g,'&quot;')+'" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px"/>';
    lb.style.display='flex';
  },
  swapPDImg(url,dot){
    const hero=document.querySelector('.pd-hero img');
    if(hero)hero.src=url;
    document.querySelectorAll('.pd-dot').forEach(d=>d.classList.remove('on'));
    if(dot)dot.classList.add('on');
  },
  openSkinCam(){
    if(typeof window._skinCamOpen==='function'){ window._skinCamOpen(); }
    else { this.toast && this.toast('Skin scan loading…'); }
  },
  openTrack(){this._closeAllModals();State.trackOrder=null;State.trackError='';$('track-modal').classList.add('on');this._pushModal('track');$('track-body').innerHTML=this._trackHTML();setTimeout(()=>{const i=document.getElementById('track-input-id');if(i)i.focus()},100)},
  closeTrack(){$('track-modal').classList.remove('on');this._popModal()},
  async submitTrack(){
    const input=document.getElementById('track-input-id'),id=(input&&input.value||'').trim();
    if(!id){toast('Enter your Order ID','err');return}
    $('track-body').innerHTML='<div class="loading">Looking up your order...</div>';
    const order=await Store.lookupOrder(id);
    if(!order){State.trackError='Order not found — please check your ID';State.trackOrder=null}
    else{State.trackError='';State.trackOrder=order}
    $('track-body').innerHTML=this._trackHTML();
  },
  _trackHTML(){
    const order=State.trackOrder,err=State.trackError;
    let h=`<div class="track-input-row"><input id="track-input-id" class="track-input" placeholder="BHN1234567" value="${order?esc(order.id):''}" onkeydown="if(event.key==='Enter')B.submitTrack()"/><button class="track-btn" onclick="B.submitTrack()">Track</button></div>`;
    if(err)return h+`<div class="track-msg err">⚠ ${esc(err)}</div>`;
    if(!order)return h+`<div class="track-msg info">Enter your Order ID (starts with BHN, on your order confirmation)</div>`;
    return h+this._timelineHTML(order);
  },
  _timelineHTML(order){
    const ck=order.trackingStatus||'received',ci=TRACKING_STATUSES.findIndex(s=>s.key===ck);
    const prog=ci>=0?Math.round((ci/Math.max(1,TRACKING_STATUSES.length-1))*100):0;
    const lu=order.lastUpdate?new Date(order.lastUpdate):null;
    const luStr=lu?lu.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    const steps=TRACKING_STATUSES.map((s,i)=>{
      const done=i<ci,now=i===ci;let cls='',dot=`${i+1}`;
      if(done){cls='done';dot='✓'}if(now){cls='now';dot=s.icon}
      let noteH='';
      if(now&&order.trackingNote)noteH=`<div class="tl-note">✶ ${esc(order.trackingNote)}</div>`;
      else if(Array.isArray(order.statusHistory)){const h=order.statusHistory.slice().reverse().find(x=>x.status===s.key&&x.note);if(h&&(done||now))noteH=`<div class="tl-note">✶ ${esc(h.note)}</div>`}
      let metaH='';
      if(Array.isArray(order.statusHistory)){const h=order.statusHistory.slice().reverse().find(x=>x.status===s.key);if(h&&h.ts){const d=new Date(h.ts);metaH=`<div class="tl-meta">${d.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>`}}
      return `<div class="tl-step ${cls}"><div class="tl-dot">${dot}</div><div class="tl-label">${esc(s.label)}</div>${metaH}${noteH}</div>`;
    }).join('');
    return `<div class="tl-wrap"><div class="tl-header"><div class="tl-orderid">Order ${esc(order.id)}</div><div class="tl-name">${esc((order.customer&&order.customer.name)||'Your Order')}</div><div class="tl-update">${luStr?'Last update · '+luStr:''}</div></div><div class="tl" style="--progress:${prog}%">${steps}</div></div>`;
  },

  // WhatsApp checkout
  async sendOrder(which){
    const c=State.customer;
    if(!c.name||!c.phone||!c.address){toast('Please fill name, phone & address','err');return}
    if(!State.cart.length){toast('Cart is empty','err');return}
    const t=computeTotals(),orderId='BHN'+Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b%31]).join('');
    const order={
      id:orderId,
      items:State.cart.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty,image:i.image})),
      subtotal:t.subtotal,shipping:t.shipping,discount:t.discount,total:t.total,
      customer:{name:c.name,phone:c.phone,address:c.address,area:c.area},
      payment:{method:State.payment,sentVia:which},
      couponCode:State.coupon?State.coupon.code:null,
      status:'pending',trackingStatus:'received',
      trackingNote:'Order placed via WhatsApp '+(which==='whatsapp1'?'1':'2'),
      statusHistory:[{status:'received',note:'Order placed via WhatsApp '+(which==='whatsapp1'?'1 ('+esc(State.settings.whatsappLabel1||'')+')':'2 ('+esc(State.settings.whatsappLabel2||'')+')'),ts:Date.now()}]
    };
    try{await Store.createOrder(order)}catch(e){console.warn('order save failed',e)}
    const msg=buildWAMsg(order,State.settings);
    const num=which==='whatsapp1'?(State.settings.whatsappNumber1||''):(State.settings.whatsappNumber2||'');
    if(!num){toast('WhatsApp number not configured','err');return}
    const url=`https://wa.me/${num.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(msg)}`;
    State.cart=[];this._saveCart();State.coupon=null;
    try{localStorage.setItem('bhan_last_order_id',orderId)}catch(e){}
    window.location.href=url;
    setTimeout(()=>{State.page='home';render();toast('✶ Order '+orderId+' placed','ok')},800);
  },
  changePDQty(d){const n=$('pd-qty');if(!n)return;let v=(parseInt(n.textContent)||1)+d;if(v<1)v=1;n.textContent=String(v)}
};
window.B=B;

// ─── Totals ───
function computeTotals(){
  const sub=State.cart.reduce((s,i)=>s+(i.price||0)*(i.qty||0),0);const st=State.settings;
  let ship=0;if(sub>0){if(sub>=(st.freeShippingThreshold||2000))ship=0;else ship=State.customer.area==='outside'?(st.shippingOutsideDhaka||130):(st.shippingInsideDhaka||80)}
  let disc=0;if(State.coupon){if(State.coupon.type==='percent')disc=Math.round(sub*(State.coupon.value||0)/100);else disc=State.coupon.value||0;if(disc>sub)disc=sub}
  return{subtotal:sub,shipping:ship,discount:disc,total:Math.max(0,sub+ship-disc)};
}

// ─── WhatsApp message ───
function buildWAMsg(order,settings){
  const items=order.items.map((it,i)=>`${i+1}. ${it.name} x ${it.qty} — ৳${(it.price*it.qty).toLocaleString('en-IN')}`).join('\n');
  const area=order.customer.area==='outside'?'Outside Dhaka':'Inside Dhaka';
  const pay=({bkash:'bKash',nagad:'Nagad',rocket:'Rocket',cod:'Cash on Delivery'})[order.payment.method]||'COD';
  // Payment instructions based on method
  let payInstructions = '';
  if (order.payment.method === 'bkash' && State.settings.bkashNumber) {
    payInstructions = `\n\n💳 Payment Details:\nMethod: bKash\nAmount: ৳${order.total.toLocaleString('en-IN')}\nSend to: ${State.settings.bkashNumber}\nReference: ${order.customer.phone}\n\n📸 I will send the bKash screenshot in next message.`;
  } else if (order.payment.method === 'nagad' && State.settings.nagadNumber) {
    payInstructions = `\n\n💳 Payment Details:\nMethod: Nagad\nAmount: ৳${order.total.toLocaleString('en-IN')}\nSend to: ${State.settings.nagadNumber}\nReference: ${order.customer.phone}\n\n📸 I will send the Nagad screenshot in next message.`;
  } else if (order.payment.method === 'cod') {
    payInstructions = `\n\n💵 Payment: Cash on Delivery (৳${order.total.toLocaleString('en-IN')} on receiving)`;
  } else {
    payInstructions = `\n\n💳 Payment: ${pay}`;
  }

  return `🛍️ NEW ORDER — b·han\n\nOrder ID: ${order.id}\n\n📦 Items:\n${items}\n\n💰 Subtotal: ৳${order.subtotal.toLocaleString('en-IN')}\n${order.discount>0?'🎟️ Discount: -৳'+order.discount.toLocaleString('en-IN')+'\n':''}🚚 Shipping: ৳${order.shipping.toLocaleString('en-IN')} (${area})\n✅ Grand Total: ৳${order.total.toLocaleString('en-IN')}\n\n👤 Customer:\nName: ${order.customer.name}\nPhone: ${order.customer.phone}\nAddress: ${order.customer.address}${payInstructions}\n\nPlease confirm my order. Thank you!`;
}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════
function render(){
  const root=$('app');if(State.loading){root.innerHTML='<div class="skel-wrap"><div class="skel skel-hero"></div><div class="skel-row"><div class="skel skel-pill"></div><div class="skel skel-pill"></div><div class="skel skel-pill"></div></div><div class="skel-grid"><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div></div></div>';return}
  const cc=State.cart.reduce((s,i)=>s+(i.qty||0),0);const s=State.settings;const u=State.user;
  let html=`<div class="announce">${esc(s.announcement||'')}</div>`;
  // Header with user avatar or login
  const userBtn=u
    ?`<button class="icon-btn" onclick="B.go('profile')" title="Profile" aria-label="Your profile" style="font-size:12px;background:var(--ink);color:var(--cream)">${esc((u.name||'?')[0].toUpperCase())}</button>`
    :`<button class="icon-btn" onclick="B.openAuth('login')" title="Login" aria-label="Sign in to your account" style="font-size:11px">→⊕</button>`;
  const backBtn=State.page!=='home'?`<button class="icon-btn" onclick="history.back()" aria-label="Go back" style="margin-right:8px;font-size:15px">‹</button>`:'';
  html+=`<header class="header" role="banner">${backBtn}<div class="logo" onclick="B.go('home')" role="button" aria-label="Go to home page"><span class="logo-text">b·han</span><span class="logo-sub">${esc(s.tagline||'Seoul → Dhaka')}</span></div><div class="head-icons">${userBtn}<button class="icon-btn" onclick="B.go('cart')" title="Cart" aria-label="Shopping cart with ${cc} items">◯${cc>0?`<span class="badge">${cc}</span>`:''}</button></div></header>`;
  if(State.page==='home')html+=renderHome();
  else if(State.page==='products')html+=renderProducts();
  else if(State.page==='cart')html+=renderCart();
  else if(State.page==='checkout')html+=renderCheckout();
  else if(State.page==='product')html+=renderPD();
  else if(State.page==='orders')html+=renderMyOrders();
  else if(State.page==='profile')html+=renderProfile();
  const nv=(k,ic,lb)=>`<button class="nav-item ${State.page===k?'on':''}" onclick="B.go('${k}')"><span class="ni-icon">${ic}</span><span class="ni-label">${lb}</span></button>`;
  const ordersNav=u?nv('orders','≡','Orders'):`<button class="nav-item" onclick="B.openAuth('login')"><span class="ni-icon">→⊕</span><span class="ni-label">Login</span></button>`;
  root.innerHTML=html;
  // Render nav OUTSIDE #app (fixed positioning breaks inside scrolled containers on iOS)
  let navbar=document.getElementById('navbar');
  if(!navbar){navbar=document.createElement('div');navbar.id='navbar';document.body.appendChild(navbar);}
  navbar.innerHTML=`<nav class="nav" role="navigation" aria-label="Main navigation">${nv('home','◐','Home')}${nv('products','✦','Shop')}${nv('cart','◯','Bag')}${ordersNav}</nav>`;
  const sI=document.getElementById('search-input');if(sI)sI.addEventListener('input',e=>{clearTimeout(window._searchT);const v=e.target.value;window._searchT=setTimeout(()=>B.setSearch(v),150)});
}

// ─── Product card HTML ───
function pcardHTML(p){
  const img=p.image||(p.images&&p.images[0])||'';
  const imgH=img?`<img src="${esc(img)}" alt="${esc(p.name||'')}" loading="lazy" style="width:100%;height:100%;object-fit:contain;padding:10px"/>`:'<span style="font-size:40px;opacity:.5;position:relative;z-index:1">✶</span>';
  const tag=p.featured?'<div class="pcard-tag">BEST</div>':p.isNew?'<div class="pcard-tag">NEW</div>':'';
  const old=p.oldPrice&&p.oldPrice>p.price?`<span class="pcard-old">${fmt(p.oldPrice)}</span>`:'';
  const salePct=p.oldPrice&&p.oldPrice>p.price?Math.round((1-p.price/p.oldPrice)*100):0;
  const saleBadge=salePct>0?`<div class="pcard-sale">-${salePct}%</div>`:'';
  return `<div class="pcard" onclick="B.go('product',{product:'${esc(p.id)}'})"><div class="pcard-img" style="background:linear-gradient(155deg,${safeColor(p.glassHue)},${safeColor(p.glassHue)}dd)">${imgH}${tag}${saleBadge}</div><div class="pcard-info"><div class="pcard-brand">${esc(p.brand||p.category||'')}</div><div class="pcard-name">${esc(p.name||'')}</div><div class="pcard-bot"><div><span class="pcard-price">${fmt(p.price)}</span>${old}</div><button class="pcard-add" onclick="event.stopPropagation();B.addToCart('${esc(p.id)}')">+</button></div></div></div>`;
}

// ─── HOME ───
function renderHome(){
  const s=State.settings,profile=State.skinProfile,recs=State.recommendations||[];
  const featured=State.products.filter(p=>p.featured).slice(0,4);
  const newArrivals=State.products.filter(p=>p.isNew).slice(0,4);
  const fallback=featured.length?featured:State.products.slice(0,4);
  const u=State.user;

  let html='';

  // Welcome banner (logged in)
  if(u){
    const hour=new Date().getHours();
    const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
    html+=`<div class="welcome"><div class="welcome-avatar">${esc((u.name||'?')[0].toUpperCase())}</div><div class="welcome-text"><div class="welcome-hi">${greeting}, ${esc((u.name||'').split(' ')[0])}</div><div class="welcome-sub">Your skin ritual awaits</div></div></div>`;
    // Email verification banner
    if(u&&!u.emailVerified){
      html+=`<div class="verify-banner"><div class="vb-icon">✉️</div><div class="vb-text"><div class="vb-title">Verify your email</div><div class="vb-sub">Check <strong>${esc(u.email||'')}</strong> for a verification link. Verify to place orders.</div></div><button class="vb-btn" onclick="B.resendVerify()">Resend</button></div>`;
      html+=`<div style="text-align:center;margin:0 20px 10px"><button onclick="B.refreshVerify()" style="font-size:11px;color:var(--clay);font-weight:700;letter-spacing:.05em;text-decoration:underline;background:none;border:none;cursor:pointer">I've verified → Refresh status</button></div>`;
    }
  }

  // Hero
  html+=`<section class="hero"><div class="hero-card"><div class="dew-orb"><div class="dew-drop"></div></div><div class="hero-offer">${esc(s.heroOffer||'Spring · 春')}</div><div class="hero-title">The <em>quiet</em>\nglow ritual.</div><div class="hero-sub">${esc(s.heroSubtitle||'')}</div><div class="hero-cta"><button class="btn-ink" onclick="B.go('products')">Begin the ritual <span>→</span></button>${u?'<button class="btn-outline" onclick="B.go(\'orders\')">My orders</button>':'<button class="btn-outline" onclick="B.openAuth(\'login\')">Sign in</button>'}</div><div class="hero-trust"><span>✶ Authentic from Olive Young</span><span>✶ Free over ৳2,000</span></div></div></section>`;

  // Trust bar (Olive Young inspired)
  html+=`<div class="trust-bar"><div class="trust-item"><span class="trust-icon">🇰🇷</span>Direct from Seoul</div><div class="trust-item"><span class="trust-icon">✓</span>100% authentic</div><div class="trust-item"><span class="trust-icon">📦</span>7-day delivery</div><div class="trust-item"><span class="trust-icon">💳</span>bKash / Nagad</div></div>`;

  // Quiz OR Camera banner
  if(!profile){
    html+=`<div style="display:flex;gap:10px;padding:0 20px;margin:14px 0">
      <div class="quiz-banner" style="flex:1;margin:0" onclick="B.openQuiz()">
        <div class="qb-icon">✶</div>
        <div class="qb-text">
          <div class="qb-title">Skin quiz</div>
          <div class="qb-sub">Answer 3 questions</div>
        </div>
      </div>
      <div class="quiz-banner" style="flex:1;margin:0;border-color:var(--clay)" onclick="B.openSkinCam()">
        <div class="qb-icon">📷</div>
        <div class="qb-text">
          <div class="qb-title" style="color:var(--clay)">Skin scan</div>
          <div class="qb-sub">Camera analysis</div>
        </div>
      </div>
    </div>`;
  } else {
    const profileSource = profile.source === 'camera' ? '📷 Camera scan' : '✶ Quiz';
    html+=`<div class="recs-banner"><div class="recs-icon">${profile.source==='camera'?'📷':'✶'}</div><div class="recs-text"><div class="recs-title">Your skin profile</div><div class="recs-sub">${esc((profile.skinType||'').toUpperCase())} · ${esc((profile.concerns||[]).slice(0,2).join(', '))} · via ${profileSource}</div></div><button class="recs-retake" onclick="B.retakeQuiz()">Quiz</button></div>`;
    html+=`<div style="display:flex;gap:8px;padding:0 20px;margin:0 0 10px"><button onclick="B.openSkinCam()" style="flex:1;padding:10px;border-radius:999px;background:var(--cream);border:1px solid var(--line);font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--ink);cursor:pointer">📷 Rescan with camera</button></div>`;
    if(recs.length){html+=`<div class="sec-hd"><div><div class="sec-sub">Just for you</div><div class="sec-title">Personalized picks</div></div></div><div class="prods">${recs.slice(0,4).map(pcardHTML).join('')}</div>`}
  }

  // Shop by concern (Hwahae + Sephora inspired)
  html+=`<div class="sec-hd"><div><div class="sec-sub">Shop by</div><div class="sec-title">Skin concern</div></div></div>`;
  const concernData=[
    {name:'Acne',icon:'💧',color:'#cfd9c0',search:'acne'},
    {name:'Anti-aging',icon:'✨',color:'#bdb5c7',search:'aging'},
    {name:'Dullness',icon:'🌟',color:'#f0e6d2',search:'dullness'},
    {name:'Sensitive',icon:'🌸',color:'#e8c5cf',search:'sensitive'},
    {name:'Dark Spots',icon:'🔆',color:'#f3e8d4',search:'pigment'},
    {name:'Pores',icon:'🪞',color:'#e0e6e9',search:'pores'}
  ];
  html+=`<div class="concern-grid">${concernData.map(c=>`<div class="concern-card" onclick="B.setSearch('${esc(c.search)}');B.go('products')"><div class="cc-icon" style="background:${safeColor(c.color)}">${esc(c.icon)}</div><div><div class="cc-name">${esc(c.name)}</div><div class="cc-count">${State.products.filter(p=>((p.concern||'')+(p.skinType||'')).toLowerCase().includes(c.search)).length} products</div></div></div>`).join('')}</div>`;

  // Ritual
  html+=`<div class="sec-hd"><div><div class="sec-sub">The method</div><div class="sec-title">Three-step ritual</div></div><span class="sec-link" onclick="B.go('products')" style="cursor:pointer">see all →</span></div><div class="ritual"><div class="ritual-grid"><div class="ritual-card"><span class="ritual-kanji">一</span><span class="ritual-name">Cleanse</span><span class="ritual-sub">Low-pH foam</span></div><div class="ritual-card"><span class="ritual-kanji">二</span><span class="ritual-name">Treat</span><span class="ritual-sub">Snail + heartleaf</span></div><div class="ritual-card"><span class="ritual-kanji">三</span><span class="ritual-name">Seal</span><span class="ritual-sub">SPF & sleep</span></div></div></div>`;

  // Categories
  const cats=['All',...(s.categories||[])];
  html+=`<div class="cats">${cats.map(c=>`<button class="cat ${State.category===c?'on':''}" onclick="B.setCategory('${esc(c)}');B.go('products')">${esc(c)}</button>`).join('')}</div>`;

  // Featured
  html+=`<div class="sec-hd"><div><div class="sec-sub">Editor's picks</div><div class="sec-title">Featured</div></div><span class="sec-link" onclick="B.go('products')" style="cursor:pointer">see all</span></div><div class="prods">${fallback.map(pcardHTML).join('')}</div>`;

  // Bundle card (Drunk Elephant "Smoothie" inspired)
  if(State.products.length>=3){
    const b1=State.products[0],b2=State.products[1],b3=State.products[2];
    const bundleTotal=(b1.price||0)+(b2.price||0)+(b3.price||0);
    const bundleSale=Math.round(bundleTotal*0.8);
    html+=`<div class="bundle"><div class="bundle-sub">The ritual set</div><div class="bundle-title">Glass Skin<br/>Starter Kit</div><div class="bundle-items"><div class="bundle-item" style="background:${safeColor(b1.glassHue)}">✶</div><div class="bundle-item" style="background:${safeColor(b2.glassHue)}">✶</div><div class="bundle-item" style="background:${safeColor(b3.glassHue)}">✶</div></div><div class="bundle-price"><span class="bundle-new">${fmt(bundleSale)}</span><span class="bundle-old">${fmt(bundleTotal)}</span><span class="bundle-save">Save 20%</span></div><button class="bundle-cta" onclick="B.addToCart('${esc(b1.id)}');B.addToCart('${esc(b2.id)}');B.addToCart('${esc(b3.id)}')">Add all three →</button></div>`;
  }

  // New arrivals
  if(newArrivals.length){
    html+=`<div class="sec-hd"><div><div class="sec-sub">This week</div><div class="sec-title">Newly arrived</div></div></div><div class="prods">${newArrivals.map(pcardHTML).join('')}</div>`;
  }

  // Curated
  const lux=State.products.find(p=>p.price>=1500)||State.products[0];
  if(lux){html+=`<div class="curated" onclick="B.go('product',{product:'${esc(lux.id)}'})"><div class="curated-text"><div class="curated-sub">Curator's choice</div><div class="curated-title">One bottle.<br/>Three weeks.</div><div class="curated-desc">The night ampoule we'd send to our mothers.</div><span class="curated-btn">Read more</span></div><div class="curated-img" style="background:${safeColor(lux.glassHue)}">${lux.image?`<img src="${esc(lux.image)}" style="width:100%;height:100%;object-fit:contain;padding:8px;border-radius:12px"/>`:'<span style="font-size:34px;opacity:.7">✶</span>'}</div></div>`}

  if(!State.products.length)html+=`<div style="text-align:center;padding:30px 20px;color:var(--muted);font-family:var(--serif);font-style:italic;font-size:14px">No products yet — admin can add them</div>`;
  // Footer with policy links
  html+=`<div style="text-align:center;padding:30px 20px 24px;font-size:11px;color:var(--muted);border-top:1px dashed var(--line);margin:30px 20px 0"><div style="margin-bottom:8px">b·han · Seoul → Dhaka</div><a href="/privacy.html" style="color:var(--clay);text-decoration:underline;margin:0 6px">Privacy Policy</a><span style="opacity:.4">·</span><a href="/terms.html" style="color:var(--clay);text-decoration:underline;margin:0 6px">Terms of Service</a></div>`;
  return `<div class="page on">${html}</div>`;
}

// ─── PRODUCTS ───
function renderProducts(){
  const cats=['All',...(State.settings.categories||[])];const q=(State.search||'').toLowerCase();
  let list=State.products.slice();
  if(State.category&&State.category!=='All')list=list.filter(p=>(p.category||'').toLowerCase()===State.category.toLowerCase());
  if(q)list=list.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q)||(p.brand||'').toLowerCase().includes(q));
  return `<div class="page on"><div class="search-wrap"><input id="search-input" placeholder="Search K-beauty..." value="${esc(State.search)}"/></div><div class="cats">${cats.map(c=>`<button class="cat ${State.category===c?'on':''}" onclick="B.setCategory('${esc(c)}')">${esc(c)}</button>`).join('')}</div><div class="sec-hd"><div><div class="sec-sub">${list.length} products</div><div class="sec-title">${esc(State.category)}</div></div></div><div class="prods">${list.length?list.map(pcardHTML).join(''):'<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted);font-family:var(--serif);font-style:italic">No products found</div>'}</div></div>`;
}

// ─── PRODUCT DETAIL ───
function renderPD(){
  const p=State.products.find(x=>x.id===State.selectedProduct);
  if(!p)return `<div class="page on"><div class="cart-empty"><div class="ce-icon">✶</div><div class="ce-msg">Product not found</div></div></div>`;
  const imgs=(p.images&&p.images.length?p.images:(p.image?[p.image]:[])).filter(Boolean);
  const img=imgs[0]||'';
  const imgH=img?`<img src="${esc(img)}" alt="${esc(p.name)}" onclick="B.zoomImg('${esc(img)}')" style="width:100%;height:100%;object-fit:contain;padding:20px;position:relative;z-index:1;cursor:zoom-in"/>`:'<span class="pd-hero-icon">✶</span>';
  const old=p.oldPrice&&p.oldPrice>p.price?`<span class="pd-old-price">${fmt(p.oldPrice)}</span>`:'';
  const salePct=p.oldPrice&&p.oldPrice>p.price?Math.round((1-p.price/p.oldPrice)*100):0;
  const notes=(p.notes||p.tags||[]);
  // Also like: same category, different product
  const alsoLike=State.products.filter(x=>x.id!==p.id&&(x.category===p.category||x.featured)).slice(0,6);
  // Free shipping progress
  const cartTotal=State.cart.reduce((s,i)=>s+(i.price||0)*(i.qty||0),0);
  const threshold=State.settings.freeShippingThreshold||2000;
  const remaining=Math.max(0,threshold-cartTotal);
  const shipProg=Math.min(100,Math.round((cartTotal/threshold)*100));

  return `<div class="page on">
    <div class="pd-back"><button class="pd-back-btn" onclick="B.go('products')">←</button><div class="pd-label">Detail · 詳細</div><button class="pd-back-btn" onclick="B.go('cart')">◯</button></div>
    <div class="pd-hero" style="background:linear-gradient(160deg,${safeColor(p.glassHue)},${safeColor(p.glassHue)}cc)">
      <span class="pd-hero-num">№ 0${(State.products.indexOf(p)+1)||1}</span>
      <span class="pd-hero-kr">${esc(p.kr||'')}</span>
      ${imgH}
    </div>
    ${imgs.length>1?`<div class="pd-dots">${imgs.map((im,i)=>`<span class="pd-dot${i===0?' on':''}" onclick="B.swapPDImg('${esc(im)}',this)"></span>`).join('')}</div>`:''}
    <div class="pd-info">
      <div class="pd-brand">${esc(p.brand||'')} · ${esc(p.category||'')}</div>
      <div class="pd-name">${esc(p.name||'')}</div>
      <div class="pd-desc">${esc(p.description||p.blurb||'Premium Korean beauty essential, sourced from Seoul.')}</div>
      <div class="pd-price-row">
        <span class="pd-price">${fmt(p.price)}</span>${old}
        ${salePct>0?`<span style="font-size:11px;font-weight:700;background:var(--clay);color:#fff;padding:3px 8px;border-radius:999px;margin-left:8px">-${salePct}%</span>`:''}
      </div>
    </div>
    ${notes.length?`<div class="pd-notes">${notes.map(n=>`<span class="pd-note">✶ ${esc(n)}</span>`).join('')}</div>`:''}
    ${remaining>0?`<div class="ship-progress" style="margin:0 20px 14px"><div class="sp-text">Add <strong>${fmt(remaining)}</strong> more for free shipping</div><div class="sp-bar"><div class="sp-fill" style="width:${shipProg}%"></div></div></div>`:'<div style="margin:0 20px 14px;text-align:center;font-size:11px;color:#5a7a3a;font-weight:700;letter-spacing:.06em">✶ FREE SHIPPING ON THIS ORDER</div>'}
    ${alsoLike.length?`<div class="sec-hd"><div><div class="sec-sub">Complete the ritual</div><div class="sec-title">You may also like</div></div></div><div class="also-like"><div class="also-scroller">${alsoLike.map(a=>`<div class="also-card" onclick="B.go('product',{product:'${esc(a.id)}'})"><div class="also-img" style="background:${safeColor(a.glassHue)}"><span style="font-size:22px;opacity:.5">✶</span></div><div class="also-info"><div class="also-name">${esc(a.name)}</div><div class="also-price">${fmt(a.price)}</div></div></div>`).join('')}</div></div>`:''}
    <div style="height:100px"></div>
    <div class="pd-bottom"><div class="qty"><button class="qty-btn" onclick="B.changePDQty(-1)">−</button><span class="qty-val" id="pd-qty">1</span><button class="qty-btn" onclick="B.changePDQty(1)">+</button></div><button class="add-cart-btn" onclick="B.addToCart('${esc(p.id)}',parseInt(document.getElementById('pd-qty').textContent)||1)">Add to bag</button></div>
  </div>`;
}

// ─── CART ───
function renderCart(){
  if(!State.cart.length)return `<div class="page on"><div class="cart-empty"><div class="ce-icon">◯</div><div class="ce-msg">Your bag is empty</div><button class="btn-ink" style="margin-top:20px" onclick="B.go('products')">Begin the ritual →</button></div></div>`;
  const t=computeTotals();
  const threshold=State.settings.freeShippingThreshold||2000;
  const remaining=Math.max(0,threshold-t.subtotal);
  const shipProg=Math.min(100,Math.round((t.subtotal/threshold)*100));
  const items=State.cart.map(i=>`<div class="ci"><div class="ci-img" style="background:${safeColor(i.glassHue)||'var(--milky)'}">${i.image?`<img src="${esc(i.image)}"/>`:'<span style="font-size:22px;opacity:.5">✶</span>'}</div><div class="ci-info"><div class="ci-brand">${esc(i.brand||i.category||'')}</div><div class="ci-name">${esc(i.name)}</div><div class="ci-price">${fmt(i.price)}</div><div class="ci-qty"><button onclick="B.changeQty('${esc(i.id)}',-1)">−</button><span>${i.qty}</span><button onclick="B.changeQty('${esc(i.id)}',1)">+</button></div></div><button class="ci-rm" onclick="B.removeFromCart('${esc(i.id)}')">×</button></div>`).join('');
  const shipBar=remaining>0?`<div class="ship-progress"><div class="sp-text">Add <strong>${fmt(remaining)}</strong> more for free shipping</div><div class="sp-bar"><div class="sp-fill" style="width:${shipProg}%"></div></div></div>`:`<div class="ship-progress"><div class="sp-text" style="color:#5a7a3a;font-weight:700;text-align:center">✶ You've unlocked free shipping!</div><div class="sp-bar"><div class="sp-fill" style="width:100%;background:#5a7a3a"></div></div></div>`;
  return `<div class="page on"><div class="sec-hd"><div><div class="sec-sub">${State.cart.length} items</div><div class="sec-title">Your bag</div></div></div>${shipBar}<div class="cart-list">${items}</div><div class="coupon-row"><input class="coupon-input" id="coupon-input" placeholder="Coupon code" value="${esc(State.coupon?State.coupon.code:'')}"/><button class="coupon-btn" onclick="B.applyCoupon(document.getElementById('coupon-input').value)">Apply</button></div><div class="cart-total"><div class="ct-row"><span>Subtotal</span><span>${fmt(t.subtotal)}</span></div><div class="ct-row"><span>Shipping</span><span>${t.shipping?fmt(t.shipping):'FREE'}</span></div>${t.discount?`<div class="ct-row" style="color:#5a7a3a"><span>Discount</span><span>-${fmt(t.discount)}</span></div>`:''}<div class="ct-row grand"><span>Total</span><span>${fmt(t.total)}</span></div></div><button class="checkout-btn" onclick="B.go('checkout')">Continue to checkout →</button></div>`;
}

// ─── CHECKOUT ───
function renderCheckout(){
  if(!State.cart.length){State.page='cart';return renderCart()}
  // Must be logged in to checkout (email verification is a soft reminder, not a blocker —
  // orders are verified manually via WhatsApp + payment screenshot anyway)
  if(!State.user){
    return `<div class="page on"><div class="cart-empty"><div class="ce-icon">→⊕</div><div class="ce-msg">Please sign in to place an order</div><button class="btn-ink" style="margin-top:20px" onclick="B.openAuth('login')">Sign in →</button><div style="margin-top:12px;font-size:12px;color:var(--muted)">New here? <a style="color:var(--clay);font-weight:700;cursor:pointer" onclick="B.openAuth('register')">Create account</a></div></div></div>`;
  }
  let verifyReminder='';
  if(!State.user.emailVerified){
    verifyReminder=`<div style="margin:0 20px 14px;padding:11px 14px;background:#fff7ec;border:1px solid #f0ddc0;border-radius:14px;font-size:11.5px;color:#8a5a20;line-height:1.5">✉️ Tip: verify your email (check inbox or spam) to secure your account — but you can order now, we'll confirm via WhatsApp.</div>`;
  }
  const c=State.customer,s=State.settings,t=computeTotals();
  const payOpt=(k,ic,nm)=>`<div class="pay-opt ${State.payment===k?'on':''}" onclick="B.setPayment('${k}')"><div class="pay-icon">${ic}</div><div class="pay-name">${nm}</div></div>`;
  let payInfo='';
  if(State.payment==='bkash'&&s.bkashNumber)payInfo=`<div class="pay-info-box"><div style="font-weight:700;margin-bottom:6px;color:var(--clay)">🌸 bKash Payment Instructions</div><div style="font-size:12.5px;line-height:1.7"><strong>Step 1:</strong> Open bKash app → "Send Money"<br/><strong>Step 2:</strong> Send <strong>${fmt(t.total)}</strong> to <strong style="color:var(--clay);font-size:14px">${esc(s.bkashNumber)}</strong><br/><strong>Step 3:</strong> Reference: <strong>${esc(c.phone||'your phone')}</strong><br/><strong>Step 4:</strong> Send screenshot via WhatsApp below</div><div style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(194,114,74,.3);font-size:11px;color:var(--muted);line-height:1.5">🔒 <strong>Trusted partner:</strong> This is our authorized BD payment partner. Your order is processed only after payment is confirmed.</div></div>`;
  else if(State.payment==='nagad'&&s.nagadNumber)payInfo=`<div class="pay-info-box"><div style="font-weight:700;margin-bottom:6px;color:var(--clay)">🟠 Nagad Payment Instructions</div><div style="font-size:12.5px;line-height:1.7"><strong>Step 1:</strong> Open Nagad app → "Send Money"<br/><strong>Step 2:</strong> Send <strong>${fmt(t.total)}</strong> to <strong style="color:var(--clay);font-size:14px">${esc(s.nagadNumber)}</strong><br/><strong>Step 3:</strong> Reference: <strong>${esc(c.phone||'your phone')}</strong><br/><strong>Step 4:</strong> Send screenshot via WhatsApp below</div></div>`;
  else if(State.payment==='rocket'&&s.rocketNumber)payInfo=`<div class="pay-info-box"><div style="font-weight:700;margin-bottom:6px;color:var(--clay)">🚀 Rocket Payment</div><div style="font-size:12.5px;line-height:1.7">Send <strong>${fmt(t.total)}</strong> to <strong style="color:var(--clay);font-size:14px">${esc(s.rocketNumber)}</strong><br/>Then send screenshot via WhatsApp below</div></div>`;
  else if(State.payment==='cod')payInfo=`<div class="pay-info-box"><div style="font-weight:700;margin-bottom:6px;color:var(--clay)">💵 Cash on Delivery</div><div style="font-size:12.5px;line-height:1.6">Pay <strong>${fmt(t.total)}</strong> in cash when you receive your order at your doorstep.</div></div>`;
  const filled=c.name&&c.phone&&c.address;
  const lbl1=s.whatsappLabel1||'Akash',lbl2=s.whatsappLabel2||'Imran';
  const waH=filled?`<div class="wa-section"><div class="wa-title">Choose how to order</div><div class="wa-sub">Tap either button to send via WhatsApp</div><div class="wa-grid"><button class="wa-btn" ${s.whatsappNumber1?'':'disabled style="opacity:.5"'} onclick="B.sendOrder('whatsapp1')"><div class="wa-icon">📱</div><div class="wa-label">WhatsApp 1</div><div class="wa-name">${esc(lbl1)}</div></button><button class="wa-btn" ${s.whatsappNumber2?'':'disabled style="opacity:.5"'} onclick="B.sendOrder('whatsapp2')"><div class="wa-icon">📱</div><div class="wa-label">WhatsApp 2</div><div class="wa-name">${esc(lbl2)}</div></button></div></div>`:`<div class="wa-section"><div style="text-align:center;font-size:12px;color:var(--muted);padding:16px;background:var(--cream);border-radius:16px;font-style:italic;font-family:var(--serif)">Fill in your details above to see ordering options</div></div>`;
  return `<div class="page on"><div class="pd-back"><button class="pd-back-btn" onclick="B.go('cart')">←</button><div class="pd-label">Checkout</div><div style="width:38px"></div></div>${verifyReminder}<div class="co-form"><div class="co-card"><div class="co-title">Delivery details</div><label class="label">Full Name</label><input class="input" placeholder="Your name" value="${esc(c.name)}" oninput="B.setCustomer('name',this.value)"/><label class="label">Phone</label><input class="input" type="tel" placeholder="01XXXXXXXXX" value="${esc(c.phone)}" oninput="B.setCustomer('phone',this.value)"/><label class="label">Address</label><textarea class="input textarea" placeholder="House, Road, Area, City" oninput="B.setCustomer('address',this.value)">${esc(c.address)}</textarea><label class="label">Delivery Area</label><div class="row2"><button class="pay-opt ${c.area==='inside'?'on':''}" onclick="B.setCustomer('area','inside')"><div class="pay-name">Inside Dhaka</div><div style="font-size:10px;color:var(--muted);margin-top:3px">${fmt(s.shippingInsideDhaka||80)}</div></button><button class="pay-opt ${c.area==='outside'?'on':''}" onclick="B.setCustomer('area','outside')"><div class="pay-name">Outside Dhaka</div><div style="font-size:10px;color:var(--muted);margin-top:3px">${fmt(s.shippingOutsideDhaka||130)}</div></button></div></div><div class="co-card"><div class="co-title">Payment method</div><div class="pay-grid">${payOpt('bkash','🌸','bKash')}${payOpt('nagad','🟠','Nagad')}${payOpt('cod','💵','Cash on Delivery')}${s.rocketNumber?payOpt('rocket','🚀','Rocket'):''}</div>${payInfo}</div><div class="co-card"><div class="co-title">Order summary</div><div class="ct-row"><span>${State.cart.length} items</span><span>${fmt(t.subtotal)}</span></div><div class="ct-row"><span>Shipping</span><span>${t.shipping?fmt(t.shipping):'FREE'}</span></div>${t.discount?`<div class="ct-row" style="color:#5a7a3a"><span>Discount</span><span>-${fmt(t.discount)}</span></div>`:''}<div class="ct-row grand"><span>Total</span><span>${fmt(t.total)}</span></div></div></div>${waH}</div>`;
}

// ─── INIT ───
// ─── MY ORDERS ───
function renderMyOrders(){
  if(!State.user) return `<div class="page on"><div class="cart-empty"><div class="ce-icon">→⊕</div><div class="ce-msg">Sign in to see your orders</div><button class="btn-ink" style="margin-top:20px" onclick="B.openAuth('login')">Sign in →</button></div></div>`;
  // Load orders async
  if(!State._myOrdersLoaded){
    State._myOrdersLoaded=true;State._myOrders=[];
    Store.getMyOrders().then(orders=>{State._myOrders=orders;render()}).catch(e=>{State._myOrders=[];render()});
    return `<div class="page on"><div class="loading">Loading your orders...</div></div>`;
  }
  const orders=State._myOrders||[];
  const dateStr=(ts)=>{if(!ts)return'';const d=new Date(ts);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})};
  const statusCls=(s)=>({pending:'ms-pending',confirmed:'ms-confirmed',processing:'ms-processing',shipped:'ms-shipped',delivered:'ms-delivered',cancelled:'ms-cancelled'})[s||'pending']||'ms-pending';
  let html=`<div class="sec-hd"><div><div class="sec-sub">${orders.length} orders</div><div class="sec-title">My orders</div></div><button class="btn-outline" style="font-size:10px;padding:8px 14px" onclick="B.openTrack()">Track by ID</button></div>`;
  if(!orders.length){
    html+=`<div style="text-align:center;padding:50px 20px;color:var(--muted)"><div style="font-size:40px;margin-bottom:12px;opacity:.5">◯</div><div style="font-family:var(--serif);font-style:italic;font-size:16px">No orders yet</div><button class="btn-ink" style="margin-top:16px" onclick="B.go('products')">Start shopping →</button></div>`;
  } else {
    orders.forEach(o=>{
      const trk=TRACKING_STATUSES.find(s=>s.key===(o.trackingStatus||'received'));
      const itemNames=(o.items||[]).map(i=>i.name).slice(0,2).join(', ')+(o.items&&o.items.length>2?' +'+( o.items.length-2)+' more':'');
      html+=`<div class="my-order" onclick="B.openTrack();setTimeout(()=>{const i=document.getElementById('track-input-id');if(i){i.value='${esc(o.id)}';B.submitTrack()}},200)">
        <div class="mo-hd"><div class="mo-id">${esc(o.id)}</div><div class="mo-date">${dateStr(o.createdAt)}</div></div>
        <div class="mo-items">${esc(itemNames)}</div>
        <div class="mo-bot">
          <div class="mo-total">${fmt(o.total)}</div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px">${trk?trk.icon:''}</span>
            <span class="mo-status ${statusCls(o.status)}">${esc(o.status||'pending')}</span>
          </div>
        </div>
      </div>`;
    });
  }
  return `<div class="page on">${html}</div>`;
}

// ─── PROFILE ───
function renderProfile(){
  if(!State.user) return `<div class="page on"><div class="cart-empty"><div class="ce-icon">→⊕</div><div class="ce-msg">Sign in to see your profile</div><button class="btn-ink" style="margin-top:20px" onclick="B.openAuth('login')">Sign in →</button></div></div>`;
  const u=State.user;
  const verified=u.emailVerified;
  const verifyBadge=verified
    ?'<span style="font-size:10px;font-weight:700;color:#5a7a3a;background:#e8f0d8;padding:3px 8px;border-radius:999px;margin-left:8px">✓ Verified</span>'
    :'<span style="font-size:10px;font-weight:700;color:#8a5a20;background:#fff3e0;padding:3px 8px;border-radius:999px;margin-left:8px">⚠ Unverified</span>';
  return `<div class="page on">
    <div class="sec-hd"><div><div class="sec-sub">Account</div><div class="sec-title">Your profile</div></div></div>
    <div class="profile-card">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px dashed var(--line)">
        <div class="auth-avatar" style="width:48px;height:48px;border-radius:24px;font-size:22px">${esc((u.name||'?')[0].toUpperCase())}</div>
        <div>
          <div style="font-family:var(--serif);font-size:20px;font-style:italic;font-weight:500">${esc(u.name)}</div>
          <div style="font-size:11px;color:var(--muted)">${esc(u.email||'')}${verifyBadge}</div>
        </div>
      </div>
      ${!verified?`<div class="verify-banner" style="margin:0 0 16px"><div class="vb-icon">✉️</div><div class="vb-text"><div class="vb-title">Email not verified</div><div class="vb-sub">You need to verify before placing orders</div></div><button class="vb-btn" onclick="B.resendVerify()">Resend</button></div><div style="text-align:center;margin-bottom:14px"><button onclick="B.refreshVerify()" style="font-size:11px;color:var(--clay);font-weight:700;background:none;border:none;cursor:pointer;text-decoration:underline">I've verified → Refresh</button></div>`:''}
      <label class="label">Name</label>
      <input class="input" id="prof-name" value="${esc(u.name||'')}"/>
      <label class="label">Email (read-only)</label>
      <input class="input" value="${esc(u.email||'')}" disabled style="opacity:.6"/>
      <label class="label">Phone (BD)</label>
      <input class="input" id="prof-phone" type="tel" value="${esc(u.phone||'')}" placeholder="01XXXXXXXXX"/>
      <label class="label">Delivery Address</label>
      <textarea class="input textarea" id="prof-addr" placeholder="House, Road, Area, City">${esc(u.address||State.customer.address||'')}</textarea>
      <label class="label">Default Area</label>
      <div class="row2">
        <button class="pay-opt ${(u.area||State.customer.area)==='inside'?'on':''}" onclick="State.customer.area='inside';if(State.user)State.user.area='inside';render()"><div class="pay-name">Inside Dhaka</div></button>
        <button class="pay-opt ${(u.area||State.customer.area)==='outside'?'on':''}" onclick="State.customer.area='outside';if(State.user)State.user.area='outside';render()"><div class="pay-name">Outside Dhaka</div></button>
      </div>
      <button class="auth-btn" style="margin-top:14px" onclick="B.saveProfile()">Save profile</button>
    </div>
    <div style="padding:0 20px">
      <button class="btn-ink" style="width:100%;justify-content:center;margin-bottom:10px" onclick="B.go('orders')">My orders →</button>
      <button class="profile-edit-btn" onclick="B.doLogout()">Sign out</button>
    </div>
    <div style="text-align:center;padding:24px 20px 10px;font-size:11px;color:var(--muted)">
      <a href="/privacy.html" style="color:var(--clay);text-decoration:underline;margin:0 8px">Privacy Policy</a>
      <span style="opacity:.4">·</span>
      <a href="/terms.html" style="color:var(--clay);text-decoration:underline;margin:0 8px">Terms of Service</a>
    </div>
  </div>`;
}

// ─── INIT ───
async function init(){
  try{State.cart=JSON.parse(localStorage.getItem('bhan_cart')||'[]')||[]}catch(e){State.cart=[]}

  const[settings,products]=await Promise.all([Store.getSettings(),Store.getProducts()]);
  State.settings=settings||State.settings;State.products=products||[];

  // Firebase Auth state listener
  if(useFirebase && auth){
    auth.onAuthStateChanged(async(fbUser)=>{
      if(fbUser){
        let profile=Store._ls('bhan_user_profile',null);
        if(!profile||profile.uid!==fbUser.uid){
          // Fetch from Firestore
          if(db){
            try{const doc=await db.collection('customers').doc(fbUser.uid).get();if(doc.exists)profile={uid:fbUser.uid,...doc.data()}}catch(e){}
          }
          if(!profile) profile={uid:fbUser.uid,email:fbUser.email,name:'',phone:'',address:'',area:'inside'};
        }
        profile.emailVerified=fbUser.emailVerified;
        Store._lsSet('bhan_user_profile',profile);
        State.user=profile;
        State.customer={name:profile.name||'',phone:profile.phone||'',address:profile.address||'',area:profile.area||'inside'};
      } else {
        State.user=null;
        try{localStorage.removeItem('bhan_user_profile')}catch(e){}
      }
      State.skinProfile=Store.getSkinProfile();
      if(State.skinProfile)State.recommendations=Store.recommendForProfile(State.skinProfile,State.products);
      State.loading=false;render();
    });
  } else {
    // Offline mode — restore from localStorage
    State.user=Store.getCurrentUser();
    if(State.user){State.customer={name:State.user.name||'',phone:State.user.phone||'',address:State.user.address||'',area:State.user.area||'inside'}}
    State.skinProfile=Store.getSkinProfile();
    if(State.skinProfile)State.recommendations=Store.recommendForProfile(State.skinProfile,State.products);
    State.loading=false;render();
  }
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

// ─── ANDROID BACK BUTTON / BROWSER HISTORY ───
// Seed the initial entry so back navigation has a stable base
try{history.replaceState({page:'home'},'');}catch(e){}
window._suppressPop=false;
window.addEventListener('popstate',function(e){
  if(window._suppressPop){window._suppressPop=false;return;}
  // 1) If a modal is open, back closes it (native Android behavior)
  const modalIds=['skin-cam-modal','auth-modal','quiz-modal','track-modal'];
  const openId=modalIds.find(id=>{const el=document.getElementById(id);return el&&el.classList.contains('on')});
  if(openId){
    if(openId==='skin-cam-modal'&&typeof window._skinCamClose==='function'){window._skinCamClose();}
    else{const el=document.getElementById(openId);if(el)el.classList.remove('on');}
    return;
  }
  // 2) Otherwise restore the page from history state
  const s=e.state;
  if(s&&s.page){
    State.page=s.page;
    if(s.product)State.selectedProduct=s.product;
    if(s.category)State.category=s.category;
    if(s.page!=='orders')State._myOrdersLoaded=false;
    render();
    window.scrollTo({top:0,behavior:'instant'});var _ap=document.getElementById('app');if(_ap)_ap.scrollTop=0;
  }
});

// ─── CONNECTION STATUS ───
window.addEventListener('offline',function(){if(typeof toast==='function')toast('You\'re offline — some features may not work','err')});
window.addEventListener('online',function(){if(typeof toast==='function')toast('✶ Back online','ok')});


// ═══ HOLOGRAM FX (Phase 2): dew particles + 3D card tilt ═══
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  // dew bubble field
  function startBubbles(){
    if(document.getElementById('sparkle-layer'))return;
    const cv=document.createElement('canvas');cv.id='sparkle-layer';
    document.body.appendChild(cv);
    const ctx=cv.getContext('2d');let W,H,DPR=Math.min(2,devicePixelRatio||1);
    function size(){W=Math.min(480,innerWidth);H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+'px';cv.style.height=H+'px';cv.style.position='fixed';cv.style.top=0;cv.style.left='50%';cv.style.transform='translateX(-50%)';ctx.setTransform(DPR,0,0,DPR,0,0)}
    size();addEventListener('resize',size);
    const T=[[240,161,136],[156,200,180],[217,182,94],[235,240,232]];
    const N=120,bs=[];
    function mk(any){const t=T[Math.floor(Math.random()*T.length)];return{x:Math.random()*W,y:any?Math.random()*H:H+10,r:1.5+Math.random()*4,v:.2+Math.random()*.7,dr:(Math.random()-.5)*.25,t,a:.2+Math.random()*.4,w:Math.random()*6.28}}
    for(let i=0;i<N;i++)bs.push(mk(true));
    (function frame(){ctx.clearRect(0,0,W,H);for(const b of bs){b.y-=b.v;b.w+=.02;b.x+=b.dr+Math.sin(b.w)*.15;if(b.y<-12||b.x<-12||b.x>W+12)Object.assign(b,mk(false));const g=ctx.createRadialGradient(b.x-b.r*.35,b.y-b.r*.35,b.r*.1,b.x,b.y,b.r);g.addColorStop(0,'rgba(255,255,255,'+(b.a+.3)+')');g.addColorStop(1,'rgba('+b.t[0]+','+b.t[1]+','+b.t[2]+','+(b.a*.5)+')');ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,6.283);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba('+b.t[0]+','+b.t[1]+','+b.t[2]+','+(b.a*.7)+')';ctx.lineWidth=.5;ctx.stroke()}requestAnimationFrame(frame)})();
  }
  if(document.readyState!=='loading')startBubbles();else addEventListener('DOMContentLoaded',startBubbles);

  // 3D tilt on product cards (event delegation, survives re-renders)
  document.addEventListener('pointermove',e=>{
    const c=e.target.closest&&e.target.closest('.pcard');
    document.querySelectorAll('.pcard').forEach(el=>{if(el!==c)el.style.transform=''});
    if(!c)return;
    const r=c.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    c.style.transform='perspective(600px) rotateY('+(x*7)+'deg) rotateX('+(-y*7)+'deg)';
  },{passive:true});
  document.addEventListener('pointerleave',()=>document.querySelectorAll('.pcard').forEach(el=>el.style.transform=''),true);
})();
