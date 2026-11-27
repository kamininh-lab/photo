// LAN の協力プレイ（試作）。
//   親のパソコンがゲームを動かし、画面と音を子のパソコンへ映像として送る。子は押したキーだけを親へ送り、四角のドローン（2P）を動かす。
//   つなぎ方は WebRTC。サーバーは使わない。接続用のコードを 2 台の間で手で受け渡す（親のコード → 子へ、子の返事 → 親へ）。
//   外のサーバー（STUN など）は使わないので、同じ LAN の中でだけつながる。
(function () {
  'use strict';
  var R = window.REBELL, G = R.game;
  var RTC = window.RTCPeerConnection;
  var CFG = { iceServers: [] };
  var N = R.Net = { role: null, state: 'idle', host: null, guest: null };

  // ---- 接続用コード（SDP を縮めて、コピーしやすい文字にする） ----
  function b64u(u) { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function zpipe(u, S) { return new Response(new Blob([u]).stream().pipeThrough(new S('deflate-raw'))).arrayBuffer().then(function (a) { return new Uint8Array(a); }); }
  function pack(kind, sdp) {
    var raw = new TextEncoder().encode(sdp);
    if (!window.CompressionStream) return Promise.resolve(kind + '0' + b64u(raw));
    return zpipe(raw, CompressionStream).then(function (z) { return kind + '1' + b64u(z); });
  }
  function unpack(kind, code) {
    code = String(code || '').replace(/\s+/g, '');
    if (code.indexOf(kind) !== 0) return Promise.reject(new Error(kind === 'RBH' ? '親のコードではないようです（RBH で始まるコードを貼ってください）' : '子の返事のコードではないようです（RBG で始まるコードを貼ってください）'));
    var body;
    try { body = unb64u(code.slice(kind.length + 1)); } catch (e) { return Promise.reject(new Error('コードが途中で切れているようです')); }
    if (code.charAt(kind.length) === '0') return Promise.resolve(new TextDecoder().decode(body));
    return zpipe(body, DecompressionStream).then(function (u) { return new TextDecoder().decode(u); }, function () { throw new Error('コードが途中で切れているようです'); });
  }
  N.pack = pack; N.unpack = unpack;
  // 候補（つなぎ先のアドレス）を集め終わるのを待つ（集め終わらなくても 3 秒で先へ進む）
  function gathered(pc) {
    return new Promise(function (ok) {
      if (pc.iceGatheringState === 'complete') return ok();
      var t = setTimeout(ok, 3000);
      pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } });
    });
  }

  // ---- 親（ゲームを動かす側） ----
  var ALLOW = /^Numpad(\d|Add|Subtract|Enter)$/;
  function makeHost(canvas, onState) {
    var pc = new RTC(CFG), H = { pc: pc, state: 'offer' };
    var st = canvas.captureStream(30);
    st.getVideoTracks().forEach(function (t) { try { t.contentHint = 'motion'; } catch (e) { } pc.addTrack(t, st); });
    try { var au = window.REBELL_AUDIO && window.REBELL_AUDIO.tap && window.REBELL_AUDIO.tap(); if (au) au.getAudioTracks().forEach(function (t) { pc.addTrack(t, st); }); } catch (e) { }
    var ch = H.ch = pc.createDataChannel('keys', { ordered: true });
    ch.onmessage = function (e) {
      var m = String(e.data), code = m.slice(1);
      if (ALLOW.test(code) && R.Drone && R.Drone.feed) R.Drone.feed(code, m.charAt(0) === '1');
    };
    ch.onopen = function () {
      H.state = 'open'; onState(H.state);
      pc.getSenders().forEach(function (s) {      // LAN なので、画質を上げておく
        if (!s.track || s.track.kind !== 'video' || !s.getParameters) return;
        var p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
        p.encodings[0].maxBitrate = 8000000; p.encodings[0].maxFramerate = 30;
        p.degradationPreference = 'maintain-resolution';      // ドット絵がぼやけないよう、重いときは解像度でなくコマ数を落とす
        s.setParameters(p).catch(function () { });
      });
    };
    ch.onclose = function () { if (R.Drone && R.Drone.feedReset) R.Drone.feedReset(); H.state = 'lost'; onState(H.state); };
    pc.onconnectionstatechange = function () { if (pc.connectionState === 'failed') { H.state = 'failed'; onState(H.state); } };
    H.offer = pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return gathered(pc); })
      .then(function () { return pack('RBH', pc.localDescription.sdp); });
    H.accept = function (code) { return unpack('RBG', code).then(function (sdp) { H.state = 'connecting'; onState(H.state); return pc.setRemoteDescription({ type: 'answer', sdp: sdp }); }); };
    H.close = function () { try { pc.close(); } catch (e) { } st.getTracks().forEach(function (t) { if (t.kind === 'video') t.stop(); }); };
    return H;
  }
  // ---- 子（2P で参加する側） ----
  function makeGuest(code, onStream, onState) {
    var pc = new RTC(CFG), C = { pc: pc, state: 'answer', ch: null };
    pc.ontrack = function (e) { var s = e.streams && e.streams[0]; if (!s) { s = C.stream || new MediaStream(); s.addTrack(e.track); } if (s !== C.stream) { C.stream = s; onStream(s); } };
    pc.ondatachannel = function (e) {
      C.ch = e.channel;
      C.ch.onopen = function () { C.state = 'open'; onState(C.state); };
      C.ch.onclose = function () { C.state = 'lost'; onState(C.state); };
    };
    pc.onconnectionstatechange = function () { if (pc.connectionState === 'failed') { C.state = 'failed'; onState(C.state); } };
    C.answer = unpack('RBH', code).then(function (sdp) { return pc.setRemoteDescription({ type: 'offer', sdp: sdp }); })
      .then(function () { return pc.createAnswer(); }).then(function (a) { return pc.setLocalDescription(a); })
      .then(function () { return gathered(pc); }).then(function () { return pack('RBG', pc.localDescription.sdp); });
    C.send = function (code, down) { if (C.ch && C.ch.readyState === 'open') C.ch.send((down ? '1' : '0') + code); };
    C.close = function () { try { pc.close(); } catch (e) { } };
    return C;
  }
  N.makeHost = makeHost; N.makeGuest = makeGuest;      // 確認用にも使う

  // ---- 子のキー（テンキーが無いパソコンでも遊べるように、ふつうのキーをテンキーに読みかえる） ----
  var GKEY = {
    ArrowUp: 'Numpad8', KeyW: 'Numpad8', ArrowDown: 'Numpad2', KeyS: 'Numpad2', ArrowLeft: 'Numpad4', KeyA: 'Numpad4', ArrowRight: 'Numpad6', KeyD: 'Numpad6',
    Space: 'Numpad0', KeyJ: 'Numpad0', KeyZ: 'Numpad0', KeyK: 'Numpad5', KeyX: 'Numpad5', KeyL: 'NumpadAdd', KeyC: 'NumpadAdd', KeyQ: 'NumpadSubtract', Backspace: 'NumpadSubtract'
  };
  var phys = {}, sent = {};
  function gmap(code) { return ALLOW.test(code) ? code : GKEY[code]; }
  function gsync() {
    var want = {}, k;
    for (k in phys) if (phys[k]) { var c = gmap(k); if (c) want[c] = true; }
    for (k in want) if (!sent[k]) N.guest.send(k, true);
    for (k in sent) if (!want[k]) N.guest.send(k, false);
    sent = want;
  }
  function guestKey(e, down) {
    if (N.role !== 'guest' || !N.guest || R.typing(e) || !gmap(e.code)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    phys[e.code] = down; gsync();
  }
  window.addEventListener('keydown', function (e) { guestKey(e, true); }, true);
  window.addEventListener('keyup', function (e) { guestKey(e, false); }, true);
  window.addEventListener('blur', function () { if (N.role === 'guest' && N.guest) { phys = {}; gsync(); } });

  // ---- 画面（ボタン・接続の手順・子の映像） ----
  var css = '#netb{position:fixed;top:8px;right:8px;z-index:20;font:13px "DotGothic16","Yu Gothic UI",sans-serif;color:#fff;background:rgba(20,16,60,.6);border:1px solid rgba(255,255,255,.4);border-radius:6px;padding:4px 10px;cursor:pointer}' +
    '#netb.on{background:rgba(40,120,90,.7)}#netb.bad{background:rgba(150,40,70,.75)}' +
    '#netp{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(4,3,14,.72)}#netp.show{display:flex}' +
    '#netp .box{width:min(560px,92vw);max-height:92vh;overflow:auto;background:#141032;color:#eee;border:1px solid #6b5cff;border-radius:10px;padding:16px 18px;font:14px "Yu Gothic UI","Meiryo",sans-serif;line-height:1.6}' +
    '#netp h3{margin:0 0 8px;font:bold 17px "DotGothic16","Yu Gothic UI",sans-serif;color:#ffc84a}' +
    '#netp button{font:14px "Yu Gothic UI",sans-serif;color:#fff;background:#3a2f8a;border:1px solid #8e80ff;border-radius:6px;padding:6px 12px;margin:4px 6px 4px 0;cursor:pointer}' +
    '#netp button:hover{background:#4d40b0}#netp textarea{width:100%;box-sizing:border-box;height:70px;font:11px monospace;background:#0a0820;color:#bfe;border:1px solid #554;border-radius:4px;word-break:break-all}' +
    '#netp .msg{color:#ff9db8;min-height:1.4em}#netp .ok{color:#9dffb0}#netp small{color:#aab}' +
    '#netv{position:absolute;inset:0;width:100%;height:100%;background:#000;object-fit:contain;display:none}' +
    '#netk{position:absolute;left:0;right:0;bottom:2%;text-align:center;color:#ffe8a0;font:1.9vmin "DotGothic16","Yu Gothic UI",sans-serif;text-shadow:0 0 4px #000,0 0 2px #000;pointer-events:none;transition:opacity 1s}';
  var html = '<div class="box"><h3>LAN で協力プレイ（試作）</h3>' +
    '<div id="np-menu"><p>2 台のパソコンでつなぎます。<b>親</b>のパソコンでゲームを動かし、<b>子</b>のパソコンには画面が映ります。子は 2P（四角のドローン）を動かせます。<br><small>同じ LAN の中でだけつながります。接続用のコードを 2 台の間で 1 回ずつ受け渡します（チャットや共有フォルダなど）。</small></p>' +
    '<button id="np-host">親になる（このパソコンで遊ぶ）</button><button id="np-join">子になる（2P で参加）</button></div>' +
    '<div id="np-hostbox" style="display:none"><p>① このコードを子のパソコンへ渡してください</p><textarea id="np-offer" readonly placeholder="コードを作っています…"></textarea><button id="np-copy1">コピー</button>' +
    '<p>② 子から届いた返事のコード（RBG で始まる）を貼って「つなぐ」</p><textarea id="np-ans"></textarea><button id="np-connect">つなぐ</button></div>' +
    '<div id="np-joinbox" style="display:none"><p>① 親から届いたコード（RBH で始まる）を貼って「返事を作る」</p><textarea id="np-off2"></textarea><button id="np-mk">返事を作る</button>' +
    '<div id="np-answ" style="display:none"><p>② この返事のコードを親へ渡してください。親が「つなぐ」を押すと、画面が映ります</p><textarea id="np-ans2" readonly></textarea><button id="np-copy2">コピー</button></div></div>' +
    '<p class="msg" id="np-msg"></p><button id="np-close">閉じる</button> <button id="np-stop" style="display:none">接続をやめる</button></div>';
  var $ = function (id) { return document.getElementById(id); };
  function msg(t, ok) { var m = $('np-msg'); m.textContent = t || ''; m.className = ok ? 'msg ok' : 'msg'; }
  function open(on) { $('netp').classList.toggle('show', on); if (!on) { var c = $('screen'); if (c) c.focus(); } }
  function copy(id) {
    var ta = $(id); ta.select();
    var done = function () { msg('コピーしました', true); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, function () { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  }
  function badge() {
    var b = $('netb'); if (!b) return;
    var st = N.state, show = N.role || G.state === 'logo' || G.state === 'title';
    b.style.display = show ? '' : 'none';
    b.className = st === 'open' ? 'on' : (st === 'lost' || st === 'failed') ? 'bad' : '';
    b.textContent = N.role === 'host' ? (st === 'open' ? '2P 接続中' : st === 'lost' || st === 'failed' ? '2P 切断' : 'LAN 協力（接続待ち）')
      : N.role === 'guest' ? (st === 'open' ? '2P として参加中' : st === 'lost' || st === 'failed' ? '親との接続が切れました' : 'LAN 協力（接続待ち）') : 'LAN 協力プレイ';
  }
  function stop() {
    if (N.host) N.host.close(); if (N.guest) N.guest.close();
    N.host = N.guest = null; N.role = null; N.state = 'idle'; phys = {}; sent = {};
    if (R.Drone && R.Drone.feedReset) R.Drone.feedReset();
    var v = $('netv'); if (v) { v.srcObject = null; v.style.display = 'none'; }
    var k = $('netk'); if (k) k.remove();
    var c = $('screen'); if (c) c.style.display = '';
    R.debugHold = false;
    $('np-menu').style.display = ''; $('np-hostbox').style.display = 'none'; $('np-joinbox').style.display = 'none'; $('np-stop').style.display = 'none';
    msg(''); badge();
  }
  function fail(e) { msg((e && e.message) || String(e)); }
  function onState(st) {
    N.state = st; badge();
    if (st === 'open') { msg('つながりました！', true); if (N.role === 'host') setTimeout(function () { open(false); }, 900); }
    else if (st === 'connecting') msg('つないでいます…', true);
    else if (st === 'failed') msg('つながりませんでした。2 台が同じ LAN にあるか、ファイアウォールで止められていないかを確かめてください。');
    else if (st === 'lost') msg('接続が切れました。');
  }
  function startHost() {
    if (!RTC) return fail(new Error('このブラウザは WebRTC に対応していません'));
    stop(); R.onGesture(); N.role = 'host';
    $('np-menu').style.display = 'none'; $('np-hostbox').style.display = ''; $('np-stop').style.display = '';
    $('np-offer').value = ''; $('np-ans').value = ''; msg('');
    try { N.host = makeHost($('screen'), onState); } catch (e) { return fail(e); }
    N.state = 'offer'; badge();
    N.host.offer.then(function (code) { $('np-offer').value = code; msg('コードができました（' + code.length + ' 文字）', true); }, fail);
  }
  function startJoin() {
    if (!RTC) return fail(new Error('このブラウザは WebRTC に対応していません'));
    stop(); N.role = 'guest';
    $('np-menu').style.display = 'none'; $('np-joinbox').style.display = ''; $('np-answ').style.display = 'none'; $('np-stop').style.display = '';
    $('np-off2').value = ''; $('np-ans2').value = ''; msg(''); badge();
  }
  function makeAnswer() {
    var code = $('np-off2').value; if (!code.trim()) return fail(new Error('親のコードを貼ってください'));
    if (N.guest) N.guest.close();
    N.guest = makeGuest(code, showStream, onState); N.state = 'answer';
    N.guest.answer.then(function (a) { $('np-ans2').value = a; $('np-answ').style.display = ''; msg('返事のコードができました（' + a.length + ' 文字）', true); }, fail);
  }
  // 子: 親の画面を映す（自分のゲームは止めて、音も消す）
  function showStream(s) {
    R.debugHold = true;
    try { if (window.REBELL_AUDIO) { window.REBELL_AUDIO.stopBgm(); window.REBELL_AUDIO.setMuted(true); } } catch (e) { }
    var v = $('netv'); v.srcObject = s; v.style.display = 'block'; $('screen').style.display = 'none';
    var p = v.play(); if (p && p.catch) p.catch(function () { v.muted = true; v.play(); msg('音を出すには、画面をクリックしてください'); });
    if (!$('netk')) {
      var k = document.createElement('div'); k.id = 'netk';
      k.textContent = '2P（四角のドローン）: 矢印 か WASD = 移動 ／ J・Space = 電撃弾 ／ K = 修理 ／ L = シールド ／ Q = 引っこめる（テンキーも使えます）';
      $('wrap').appendChild(k); setTimeout(function () { k.style.opacity = '0.25'; }, 10000);
    }
    setTimeout(function () { open(false); }, 900);
  }

  window.addEventListener('DOMContentLoaded', function () {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var b = document.createElement('button'); b.id = 'netb'; b.type = 'button'; document.body.appendChild(b);
    var p = document.createElement('div'); p.id = 'netp'; p.innerHTML = html; document.body.appendChild(p);
    var v = document.createElement('video'); v.id = 'netv'; v.autoplay = true; v.playsInline = true; $('wrap').appendChild(v);
    v.addEventListener('click', function () { v.muted = false; v.play(); });
    b.addEventListener('click', function (e) { e.stopPropagation(); open(true); });
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    p.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    $('np-host').onclick = startHost; $('np-join').onclick = startJoin;
    $('np-copy1').onclick = function () { copy('np-offer'); }; $('np-copy2').onclick = function () { copy('np-ans2'); };
    $('np-connect').onclick = function () { if (N.host) N.host.accept($('np-ans').value).catch(fail); };
    $('np-mk').onclick = makeAnswer;
    $('np-close').onclick = function () { open(false); };
    $('np-stop').onclick = stop;
    badge(); setInterval(badge, 500);
  });
})();
