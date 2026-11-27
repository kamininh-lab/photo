// Codex 担当: BGM と効果音（window.REBELL_AUDIO）
(function () {
  'use strict';

  // 通常160ms先読み。裏タブでは延長し、長い中断は演奏位置を飛ばす。
  const LOOKAHEAD = 0.16, HIDDEN_AHEAD = 1.25, INTERVAL = 25;
  const SILENT = 0.0001;
  let ctx = null, master = null, fx = null, music = null, noiseBuffer = null;
  let compressor = null, current = null, wanted = null, timer = null;
  let muted = false, volume = 0.72;
  const voices = new Set(), graph = [], lastSfx = new Map();
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const safe = fn => function (...args) {
    try { return fn(...args); } catch (_) { return undefined; }
  };
  const disconnect = node => { try { node.disconnect(); } catch (_) {} };
  const running = () => ctx && ctx.state === 'running';
  const rows = text => text.split('|').map(row =>
    row.trim().split(/\s+/).map(n => n === '-' ? null : Number(n)));
  const chords = text => text.split('|').map(row => row.split(',').map(Number));

  // 各行1小節、各音は8分音符。前半A、後半Bの全16小節。
  const scores = {
    title: {
      bpm: 96, loop: true,
      harmony: chords('45,48,52|41,45,48|48,52,55|43,47,50|' +
        '45,48,52|41,45,48|38,41,45|40,44,47|' +
        '41,45,48|43,47,50|45,48,52|48,52,55|' +
        '38,41,45|41,45,48|40,44,47|40,44,47'),
      melody: rows('76 - - - 72 - - -|69 - - - 72 - - -|' +
        '79 - - 76 - - 72 -|71 - - - 74 - - -|' +
        '76 - 79 - 81 - 76 -|77 - - - 76 - 72 -|' +
        '74 - - - 69 - 72 -|71 - - 68 - - - -|' +
        '77 - 81 - 84 - 81 -|79 - 83 - 86 - 83 -|' +
        '81 - 84 - 88 - 84 -|79 - 76 - 84 - 79 -|' +
        '81 - - 77 - 74 - -|77 - 76 - 72 - 69 -|' +
        '71 - 76 - 80 - 83 -|80 - 76 - 71 - - -')
    },
    city: {
      bpm: 140, loop: true,
      harmony: chords('45,48,52|45,48,52|41,45,48|43,47,50|' +
        '45,48,52|48,52,55|38,41,45|40,44,47|' +
        '41,45,48|43,47,50|45,48,52|48,52,55|' +
        '38,41,45|41,45,48|40,44,47|40,44,47'),
      melody: rows('76 - 76 79 81 - 79 76|72 76 - 79 76 72 71 -|' +
        '69 - 72 76 77 76 72 -|71 74 79 - 78 74 71 -|' +
        '76 79 81 - 84 81 79 76|79 - 76 72 76 - 79 84|' +
        '81 77 74 - 77 76 74 72|71 - 68 71 76 - 80 -|' +
        '81 84 89 - 88 84 81 77|83 86 91 - 86 83 79 -|' +
        '88 - 84 81 84 88 91 88|84 79 76 - 79 84 88 -|' +
        '86 - 81 77 81 86 89 86|84 81 77 76 77 81 84 -|' +
        '83 80 76 - 80 83 88 83|80 76 71 68 71 - 76 -')
    },
    school: {
      bpm: 126, loop: true,
      harmony: chords('45,48,52|41,45,48|38,41,45|45,48,52|' +
        '41,45,48|38,41,45|40,44,47|45,48,52|' +
        '41,45,48|45,48,52|38,41,45|41,45,48|' +
        '45,48,52|38,41,45|40,44,47|45,48,52'),
      // 主旋律はヨナ抜き短音階 A B C E F。
      melody: rows('69 - 71 72 76 - 72 -|77 76 72 - 71 69 - -|' +
        '71 - 72 76 77 - 76 72|71 69 - 72 71 - 69 -|' +
        '72 - 76 77 81 - 77 76|77 76 72 - 71 72 76 -|' +
        '71 - 76 77 76 72 71 -|69 - 72 76 72 - 69 -|' +
        '81 - 83 84 88 - 84 83|81 76 81 - 84 83 81 -|' +
        '83 84 88 - 89 88 84 83|81 - 77 76 77 81 84 -|' +
        '88 - 84 83 81 76 72 -|77 76 72 71 72 - 76 -|' +
        '83 - 77 76 72 71 76 71|69 - 72 71 69 - - -')
    },
    boss: {
      bpm: 162, loop: true,
      harmony: chords('40,43,47|40,43,47|41,45,48|40,43,47|' +
        '36,40,43|38,42,45|40,43,47|35,39,42|' +
        '36,40,43|38,42,45|40,43,47|41,45,48|' +
        '45,48,52|41,45,48|35,39,42|35,39,42'),
      melody: rows('76 76 - 79 78 76 75 -|76 83 82 79 78 - 76 -|' +
        '77 81 84 - 83 81 77 76|79 78 76 - 75 76 78 -|' +
        '79 - 76 72 76 79 83 84|81 78 74 - 78 81 86 -|' +
        '83 79 78 76 79 78 76 75|75 - 78 81 83 81 78 75|' +
        '84 88 91 - 90 88 84 83|86 90 93 - 90 86 81 -|' +
        '88 83 88 91 95 - 91 88|89 88 84 81 84 89 93 89|' +
        '93 91 88 - 84 88 93 96|89 84 81 77 81 84 89 -|' +
        '87 83 81 78 75 78 83 87|95 90 87 83 81 78 75 -')
    },
    // 中ボス戦（黒瀬 龍士）。神妙な曲: 遅く、音数を絞った、和の音階（都節 D E♭ G A B♭）。
    // 和音の欄は、低い持続音と笙ふうの響きに使う。旋律は尺八ふう（「-」のあいだは前の音を伸ばす）。編曲は solemn()
    midboss: {
      bpm: 88, loop: true,
      harmony: chords('38,45,50|38,45,51|38,43,50|38,46,50|38,45,50|39,46,51|38,43,50|38,45,51|' +
        '38,45,50|43,46,50|39,46,51|38,45,50|45,50,51|43,46,50|39,46,51|38,45,50'),
      melody: rows('62 - - - 63 - 62 -|57 - - - - - 58 -|62 - - 67 - - 69 -|70 - 69 - 67 - - -|' +
        '69 - - - 70 - 69 67|63 - - - 62 - - -|67 - 69 - 70 - 74 -|75 - 74 - 69 - - -|' +
        '74 - 75 74 70 - 69 -|67 - 69 70 74 - - -|75 - 79 - 81 - 79 75|74 - - 70 69 - 67 -|' +
        '81 - 82 81 79 - 75 -|74 75 74 70 69 - 67 -|63 - 62 - 58 - 57 -|62 - - - - - - -')
    },
    clear: { bpm: 120, loop: false, seconds: 4.35 },
    gameover: { bpm: 120, loop: false, seconds: 4.4 }
  };

  function ramp(param, value, seconds) {
    const now = ctx.currentTime;
    param.cancelAndHoldAtTime(now);
    param.linearRampToValueAtTime(value, now + Math.max(0.005, seconds));
  }

  function stopClock() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function retire(group, seconds) {
    if (!group || group.retiring) return;
    group.retiring = true;
    ramp(group.bus.gain, 0, seconds);
    const end = ctx.currentTime + Math.max(0.005, seconds) + 0.015;
    for (const v of group.voices) {
      v.end = Math.min(v.end, end);
      try { v.source.stop(v.end); } catch (_) { v.clean(); }
    }
    if (!group.voices.size) disconnect(group.bus);
  }

  function dispose() {
    stopClock();
    for (const v of Array.from(voices)) {
      try { v.source.stop(); } catch (_) {}
      v.clean();
    }
    if (current) disconnect(current.bus);
    for (const node of graph) disconnect(node);
    graph.length = 0;
    if (ctx) ctx.onstatechange = null;
    ctx = master = compressor = music = fx = noiseBuffer = current = null;
    lastSfx.clear();
  }

  function init() {
    if (ctx && ctx.state === 'closed') dispose();
    if (!ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      let ac = null;
      const made = [];
      try {
        ac = new Audio();
        const out = ac.createGain(); made.push(out);
        const comp = ac.createDynamicsCompressor(); made.push(comp);
        const bg = ac.createGain(); made.push(bg);
        const effects = ac.createGain(); made.push(effects);
        out.gain.value = muted ? 0 : volume;
        bg.gain.value = 0.36;
        effects.gain.value = 0.72;
        comp.threshold.value = -18;
        comp.knee.value = 14;
        comp.ratio.value = 8;
        comp.attack.value = 0.003;
        comp.release.value = 0.16;
        bg.connect(comp); effects.connect(comp);
        comp.connect(out); out.connect(ac.destination);
        const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        ctx = ac; master = out; compressor = comp; music = bg;
        noiseBuffer = buffer;
        fx = { bus: effects, voices: new Set(), retiring: false, endAt: Infinity };
        graph.push(...made);
        ac.onstatechange = safe(() => {
          if (ctx !== ac) return;
          if (ac.state === 'closed') dispose();
          else if (ac.state === 'running') wake();
          else stopClock();
        });
      } catch (_) {
        made.forEach(disconnect);
        if (ac) { try { Promise.resolve(ac.close()).catch(() => {}); } catch (_) {} }
        if (ctx === ac) dispose();
        return;
      }
    }
    const ac = ctx;
    if (ac.state === 'running') wake();
    else {
      try {
        Promise.resolve(ac.resume()).then(safe(() => {
          if (ctx === ac && running()) wake();
        })).catch(() => {});
      } catch (_) {}
    }
  }

  // ソースごとに終了を予約し、途中の生成失敗も含めて全ノードを回収する。
  function voice(group, when, length, options) {
    if (!running() || group.retiring || voices.size >= 256) return;
    if (group.voices.size >= (group === fx ? 80 : 128)) return;
    const t = Math.max(ctx.currentTime, when);
    const d = Math.min(length, group.endAt - t - 0.016);
    if (!(d > 0.018)) return;
    const o = options, nodes = [];
    let source = null, record = null, cleaned = false;
    const clean = () => {
      if (cleaned) return;
      cleaned = true;
      if (source) source.onended = null;
      nodes.forEach(disconnect);
      if (record) { voices.delete(record); group.voices.delete(record); }
      if (group.retiring && !group.voices.size) disconnect(group.bus);
    };
    try {
      source = o.noise ? ctx.createBufferSource() : ctx.createOscillator();
      nodes.push(source);
      if (o.noise) {
        source.buffer = noiseBuffer;
        source.loop = true;
      } else {
        source.type = o.wave || 'square';
        source.frequency.setValueAtTime(o.freq, t);
        source.frequency.exponentialRampToValueAtTime(
          Math.max(20, o.to || o.freq), t + d * 0.72);
        source.detune.value = o.detune || 0;
      }
      const filter = ctx.createBiquadFilter();
      nodes.push(filter);
      filter.type = o.filter || 'lowpass';
      filter.Q.value = o.q || 0.7;
      const limit = ctx.sampleRate * 0.45;
      filter.frequency.setValueAtTime(clamp(o.cut || 9000, 30, limit), t);
      if (o.cutTo) filter.frequency.exponentialRampToValueAtTime(
        clamp(o.cutTo, 30, limit), t + d);
      const env = ctx.createGain();
      nodes.push(env);
      const attack = Math.min(o.attack || 0.003, d * 0.3);
      const peak = o.vol || 0.1;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + attack);
      env.gain.linearRampToValueAtTime(peak * 0.72,
        t + Math.max(attack, d * (o.hold || 0.14)));
      env.gain.exponentialRampToValueAtTime(SILENT, t + d - 0.006);
      env.gain.linearRampToValueAtTime(0, t + d);
      source.connect(filter); filter.connect(env); env.connect(group.bus);
      record = { source, end: t + d + 0.01, clean };
      voices.add(record); group.voices.add(record);
      source.onended = clean;
      if (o.noise) source.start(t, Math.random() * noiseBuffer.duration);
      else source.start(t);
      source.stop(record.end);
    } catch (_) {
      if (source) { try { source.stop(); } catch (_) {} }
      clean();
    }
  }

  function tone(g, t, d, f, v, wave = 'square', to = f, cut = 9000, attack = 0.003) {
    voice(g, t, d, { freq: f, to, vol: v, wave, cut, attack });
  }

  function hiss(g, t, d, v, cut = 4500, filter = 'highpass', cutTo = cut) {
    voice(g, t, d, { noise: true, vol: v, cut, filter, cutTo });
  }

  function note(g, t, n, d, v, wave = 'square', cut = 6500) {
    if (n !== null) tone(g, t, d, hz(n), v, wave, hz(n), cut);
  }

  function pad(g, t, chord, d, bright) {
    chord.forEach((n, i) => voice(g, t, d, {
      freq: hz(n + 12), wave: 'sawtooth', vol: 0.055,
      attack: 0.16, hold: 0.62, cut: bright ? 2400 : 1250,
      cutTo: 650, detune: (i - 1) * 7
    }));
  }

  function drum(g, t, kind, v = 1) {
    if (kind === 'kick') {
      tone(g, t, 0.22, 150, 0.39 * v, 'triangle', 42, 1400);
      hiss(g, t, 0.025, 0.07 * v, 1500);
    } else if (kind === 'snare') {
      hiss(g, t, 0.15, 0.2 * v, 1400, 'highpass', 4500);
      tone(g, t, 0.09, 190, 0.09 * v, 'triangle', 115, 1800);
    } else {
      hiss(g, t, kind === 'open' ? 0.17 : 0.045,
        (kind === 'open' ? 0.075 : 0.055) * v, 6800);
    }
  }

  function jingle(g, step, t) {
    if (g.name === 'clear') {
      const fanfare = { 0: 72, 2: 76, 4: 79, 6: 84, 10: 83, 12: 86, 16: 88 };
      if (Object.prototype.hasOwnProperty.call(fanfare, step)) {
        const n = fanfare[step], d = step === 16 ? 2.1 : 0.3;
        note(g, t, n, d, 0.16);
        note(g, t, n - 12, d, 0.11, 'triangle');
      }
      if ([0, 8, 16].includes(step)) {
        const chord = step === 8 ? [43, 47, 50] : [48, 52, 55];
        pad(g, t, chord, step === 16 ? 2.3 : 1.1, true);
        drum(g, t, 'kick', 0.7);
        hiss(g, t, 0.55, 0.1, 4800);
      }
    } else {
      const fall = { 0: 76, 4: 74, 8: 72, 12: 71, 16: 68, 20: 57 };
      if (Object.prototype.hasOwnProperty.call(fall, step)) {
        note(g, t, fall[step], step === 20 ? 1.8 : 0.48, 0.17, 'triangle');
        note(g, t, fall[step] - 12, 0.8, 0.08, 'sawtooth', 1200);
      }
      if (step === 0) pad(g, t, [45, 48, 52], 2.2, false);
      if (step === 16) pad(g, t, [40, 44, 47], 2.3, false);
    }
  }

  // 中ボス戦「神妙」の編曲。前半（A）は音を絞って静かに、後半（B）は太鼓と箏が細かくなって張りつめる。
  //   低い持続音 / 笙ふうの薄い和音 / 尺八ふうの旋律（やわらかい立ち上がり・半音下からのしゃくり・息の音）/ 箏のつまびき / 太鼓 / 鈴 / 拍子木
  function solemn(g, bar, beat, b, chord, melody, eighth, barTime, t) {
    const k = beat / 2;
    if (beat === 0) {
      voice(g, t, barTime * 1.02, { freq: hz(chord[0]), wave: 'triangle', vol: 0.085, attack: 0.25, hold: 0.8, cut: 420 });
      voice(g, t, barTime * 1.02, { freq: hz(chord[1]), wave: 'sine', vol: 0.035, attack: 0.4, hold: 0.8, cut: 600 });
      chord.forEach((n, i) => voice(g, t, barTime * 0.98, {
        freq: hz(n + 24), wave: 'sawtooth', vol: b ? 0.026 : 0.018,
        attack: 0.5, hold: 0.7, cut: b ? 1500 : 1000, cutTo: 700, detune: (i - 1) * 6
      }));
    }
    if (beat % 2 === 0 && melody[k] !== null) {
      let len = 1;
      while (k + len < 8 && melody[k + len] === null) len++;
      const f = hz(melody[k]), d = eighth * len * 0.96;
      voice(g, t, d, { freq: f, wave: 'triangle', vol: 0.105, attack: 0.06, hold: 0.75, cut: 2600, cutTo: 1500, detune: -4 });
      voice(g, t, d, { freq: f, wave: 'sine', vol: 0.042, attack: 0.09, hold: 0.75, cut: 3000, detune: 5 });
      voice(g, t, Math.min(0.11, d), { freq: f * 0.944, to: f, wave: 'triangle', vol: 0.036, attack: 0.01, cut: 2000 });
      voice(g, t, Math.min(0.16, d), { noise: true, filter: 'bandpass', cut: Math.min(6000, f * 3), q: 2.2, vol: 0.026, attack: 0.02 });
      if (b) voice(g, t, d, { freq: f / 2, wave: 'triangle', vol: 0.034, attack: 0.08, hold: 0.7, cut: 1200 });
    }
    const pluck = (n, v, len) => {
      voice(g, t, len, { freq: hz(n), wave: 'triangle', vol: v, attack: 0.002, hold: 0.05, cut: 5200, cutTo: 900 });
      voice(g, t, len * 0.6, { freq: hz(n + 12), wave: 'square', vol: v * 0.22, attack: 0.002, hold: 0.04, cut: 6000, cutTo: 1500 });
    };
    const don = v => {
      tone(g, t, 0.42, 92, 0.3 * v, 'triangle', 40, 700);
      hiss(g, t, 0.09, 0.12 * v, 420, 'lowpass', 120);
      tone(g, t, 0.05, 180, 0.12 * v, 'sine', 90, 900);
    };
    const ten = v => {
      tone(g, t, 0.09, 300, 0.11 * v, 'triangle', 230, 1800);
      hiss(g, t, 0.05, 0.07 * v, 1800, 'bandpass', 900);
    };
    const ka = v => {
      tone(g, t, 0.035, 1250, 0.07 * v, 'square', 1100, 3200);
      hiss(g, t, 0.02, 0.05 * v, 3500);
    };
    const rin = () => [1, 2.76, 5.4].forEach((m, i) => voice(g, t, 2.6 - i * 0.6, {
      freq: hz(74) * m, wave: 'sine', vol: [0.06, 0.028, 0.012][i], attack: 0.002, hold: 0.03, cut: 9000
    }));
    if (!b) {
      if (beat % 2 === 0) pluck(chord[[0, 1, 2, 1, 2, 1, 0, 1][k]] + (k === 4 ? 24 : 12), k % 4 === 0 ? 0.085 : 0.06, eighth * 2.6);
      if (beat === 0) don(1);
      if (bar % 2 === 1 && (beat === 10 || beat === 12)) don(beat === 10 ? 0.5 : 0.7);
      if (bar % 2 === 0 && beat === 8) ten(0.8);
      if (bar === 7 && (beat === 8 || beat === 12 || beat === 14)) ka(1);
    } else {
      pluck(chord[[0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 2, 1][beat]] + (beat % 4 === 2 ? 24 : 12), beat % 4 === 0 ? 0.075 : 0.05, eighth * 1.8);
      if (beat === 0 || beat === 6 || beat === 8) don(beat === 6 ? 0.55 : 1);
      if (bar % 2 === 1 && beat === 14) don(0.7);
      if (beat === 4 || beat === 12) ten(1); else if (beat === 2 || beat === 10) ten(0.45);
      if (bar === 15 && [0, 4, 8, 10, 12, 13, 14, 15].includes(beat)) ka(0.7 + beat * 0.03);
    }
    if (bar % 4 === 0 && beat === 0) rin();
  }

  function arrange(g, index, t) {
    if (!g.score.loop) { jingle(g, index, t); return; }
    const s = index % 256, bar = Math.floor(s / 16), beat = s % 16;
    const b = bar >= 8, chord = g.score.harmony[bar], root = chord[0];
    const eighth = 60 / g.score.bpm / 2, barTime = eighth * 8;
    const name = g.name, melody = g.score.melody[bar];
    if (name === 'midboss') { solemn(g, bar, beat, b, chord, melody, eighth, barTime, t); return; }
    if (beat === 0) pad(g, t, chord, barTime * 0.94, b);
    if (name === 'title') {
      if (beat % 2 === 0) {
        const k = beat / 2, arp = [0, 1, 2, 1, 0, 2, 1, 2][k];
        note(g, t, chord[arp] + (b && k > 3 ? 36 : 24),
          eighth * 0.8, 0.07, 'triangle');
        note(g, t, melody[k], eighth * 2.4, 0.065, 'triangle');
      }
      if (beat === 0 || beat === 8) note(g, t, root - 12, eighth * 3, 0.15, 'triangle');
      if (b && beat === 12) hiss(g, t, 0.12, 0.025, 6500);
      return;
    }
    if (beat % 2 === 0) {
      const k = beat / 2;
      const duration = eighth * (name === 'school' ? 0.9 : 0.72);
      note(g, t, melody[k], duration, name === 'boss' ? 0.135 : 0.12,
        name === 'school' ? 'triangle' : 'square', b ? 8000 : 5200);
      if (b && k % 2 === 0) note(g, t, melody[k] === null ? null : melody[k] - 12,
        duration, 0.045, 'sawtooth', 3000);
    }
    if (name === 'boss') {
      const ost = [0, 0, 12, 0, 7, 0, 12, 1, 0, 0, 12, 0, 7, 12, 3, 1];
      note(g, t, root - 12 + ost[beat], eighth * 0.35, 0.22, 'sawtooth', 1250);
    } else if (beat % 2 === 0 || (b && beat === 15)) {
      const p = [0, 0, 12, 0, 7, 0, 12, 7][Math.floor(beat / 2)];
      note(g, t, root - 12 + p, eighth * 0.76, 0.23, 'triangle', 2200);
    }
    if (name === 'school' && [3, 7, 11, 15].includes(beat)) {
      note(g, t, chord[Math.floor(beat / 4) % 3] + 24,
        eighth * 0.45, 0.055, 'square', 3500);
    }
    const kicks = name === 'boss' ? [0, 3, 8, 10] : (b ? [0, 6, 8, 14] : [0, 8]);
    if (kicks.includes(beat)) drum(g, t, 'kick', name === 'school' ? 0.8 : 1);
    if (beat === 4 || beat === 12) drum(g, t, 'snare', name === 'school' ? 0.65 : 1);
    if (beat % (name === 'boss' && b ? 1 : 2) === 0) {
      drum(g, t, beat === 14 ? 'open' : 'hat', beat % 4 === 0 ? 1 : 0.7);
    }
    if (bar % 4 === 3 && beat >= 13) drum(g, t, 'snare', 0.35 + (beat - 13) * 0.12);
  }

  function begin(name) {
    const bus = ctx.createGain();
    try {
      bus.gain.value = 0;
      bus.connect(music);
      const score = scores[name], start = ctx.currentTime + 0.035;
      const next = {
        name, score, bus, voices: new Set(), retiring: false,
        start, next: 0, step: 60 / score.bpm / 4,
        endAt: score.loop ? Infinity : start + score.seconds
      };
      bus.gain.setValueAtTime(0, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(1, start + 0.14);
      if (!score.loop) {
        bus.gain.setValueAtTime(1, next.endAt - 0.09);
        bus.gain.linearRampToValueAtTime(0, next.endAt);
      }
      if (current) retire(current, 0.22);
      current = next;
    } catch (error) {
      disconnect(bus);
      throw error;
    }
  }

  function tick() {
    if (!running() || !current) { if (!current) stopClock(); return; }
    const g = current, now = ctx.currentTime;
    for (const v of Array.from(voices)) if (v.end < now - 0.05) v.clean();
    if (now >= g.endAt) {
      current = null;
      if (wanted === g.name) wanted = null;
      retire(g, 0.005);
      stopClock();
      return;
    }
    const nextTime = g.start + g.next * g.step;
    if (nextTime < now - 0.025) {
      g.next = Math.max(g.next, Math.ceil((now + 0.008 - g.start) / g.step));
    }
    const ahead = document.hidden ? HIDDEN_AHEAD : LOOKAHEAD;
    const end = Math.min(now + ahead, g.endAt);
    let budget = 96;
    while (budget-- > 0 && (g.score.loop || g.next < 32)) {
      const t = g.start + g.next * g.step;
      if (t >= end) break;
      const i = g.next++;
      arrange(g, i, Math.max(now, t));
    }
  }

  function wake() {
    if (!running()) return;
    if (wanted && (!current || current.name !== wanted)) begin(wanted);
    if (current && timer === null) timer = setInterval(safe(tick), INTERVAL);
    tick();
  }

  function playBgm(name) {
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(scores, name)) return;
    if (current && current.name === name && ctx.currentTime < current.endAt) {
      wanted = name;
      return;
    }
    wanted = name;
    if (running()) {
      begin(name);
      if (timer === null) timer = setInterval(safe(tick), INTERVAL);
      tick();
    }
  }

  function stopBgm(fadeSec = 0.4) {
    wanted = null;
    if (current) {
      const seconds = Number.isFinite(fadeSec) ? clamp(fadeSec, 0, 10) : 0.4;
      retire(current, seconds);
      current = null;
    }
    stopClock();
  }

  // 効果音はBGMと独立。同名30ms間引きに加え、同時ソース数も制限する。
  function effect(name, t) {
    const p = (f, to, d, v = 0.2, wave = 'square', delay = 0, cut = 9000) =>
      tone(fx, t + delay, d, f, v, wave, to, cut);
    const n = (d, v = 0.2, cut = 3500, delay = 0, type = 'highpass', to = cut) =>
      hiss(fx, t + delay, d, v, cut, type, to);
    const run = (notes, spacing, d = 0.14, wave = 'square', v = 0.17) =>
      notes.forEach((m, i) => p(hz(m), hz(m), d, v, wave, i * spacing));
    switch (name) {
      case 'select':
        run([76, 83], 0.055, 0.1); break;
      case 'start':
        run([57, 64, 69, 76, 81], 0.065, 0.22);
        n(0.18, 0.12, 5000, 0.22); break;
      case 'jump':
        p(240, 680, 0.18, 0.18, 'triangle');
        p(120, 260, 0.1, 0.07); break;
      case 'djump':
        p(450, 1350, 0.2, 0.16, 'triangle');
        run([81, 88, 93], 0.035, 0.1, 'square', 0.1); break;
      case 'land':
        p(105, 38, 0.12, 0.24, 'triangle'); n(0.09, 0.14, 900, 0, 'lowpass'); break;
      case 'dash':
        n(0.2, 0.18, 1200, 0, 'bandpass', 8000);
        p(220, 75, 0.15, 0.09, 'sawtooth'); break;
      case 'slash_red1': case 'slash_red2': case 'slash_red3': {
        const k = Number(name.slice(-1));
        p(170 + k * 30, 30, 0.2 + k * 0.045, 0.24, 'sawtooth', 0, 1700);
        n(0.16 + k * 0.045, 0.19 + k * 0.025, 700, 0, 'bandpass', 220);
        p(68, 28, 0.18, 0.22, 'triangle', 0.04);
        if (k === 3) { n(0.3, 0.26, 1800, 0.07); p(45, 25, 0.36, 0.26, 'triangle', 0.07); }
        break;
      }
      case 'slash_blue1': case 'slash_blue2': case 'slash_blue3': {
        const k = Number(name.slice(-1));
        n(0.07 + k * 0.015, 0.2, 5800 + k * 500);
        p(1700 + k * 350, 420, 0.085, 0.1, 'triangle');
        p(2700, 950, 0.065, 0.07, 'square', 0.012);
        if (k === 3) { n(0.13, 0.19, 7200, 0.06); p(3400, 1100, 0.13, 0.08, 'triangle', 0.06); }
        break;
      }
      case 'hit':
        p(940, 390, 0.075, 0.13); p(1439, 650, 0.065, 0.09);
        n(0.055, 0.18, 3000); break;
      case 'hit_heavy':
        p(112, 32, 0.26, 0.32, 'triangle');
        p(733, 170, 0.14, 0.14, 'square'); n(0.2, 0.27, 2000); break;
      case 'special_red':
        p(135, 26, 0.75, 0.38, 'sawtooth', 0, 1100);
        p(60, 25, 0.85, 0.3, 'triangle');
        n(0.8, 0.38, 2300, 0, 'lowpass', 150);
        n(0.18, 0.2, 4000, 0.035); break;
      case 'special_blue':
        for (let i = 0; i < 6; i++) {
          n(0.1, 0.19, 6200, i * 0.065);
          p(2200 + i * 240, 650, 0.1, 0.1, 'triangle', i * 0.065);
        }
        run([88, 93, 100], 0.05, 0.18, 'square', 0.09); break;
      case 'switch':
        run([69, 76, 81, 88], 0.035, 0.16, 'triangle');
        n(0.12, 0.07, 7000); break;
      case 'cross':
        p(110, 27, 0.95, 0.3, 'sawtooth', 0, 1500);
        n(0.88, 0.3, 3500, 0, 'lowpass', 250);
        run([69, 76, 81, 88, 93, 100], 0.065, 0.24, 'square', 0.12);
        [0, 0.16, 0.32, 0.5].forEach(d => n(0.16, 0.16, 6500, d));
        p(880, 1760, 0.42, 0.13, 'triangle', 0.55); break;
      case 'hurt':
        p(240, 65, 0.23, 0.22, 'sawtooth', 0, 2300);
        p(253, 70, 0.2, 0.1); n(0.12, 0.15, 2200); break;
      case 'enemy_shot':
        p(1100, 190, 0.14, 0.14, 'square'); break;
      case 'enemy_die':
        n(0.34, 0.24, 3600, 0, 'lowpass', 220);
        p(620, 45, 0.32, 0.16, 'sawtooth'); break;
      case 'explosion':
        n(0.65, 0.34, 5000, 0, 'lowpass', 120);
        p(85, 25, 0.58, 0.33, 'triangle'); break;
      case 'pickup':
        run([88, 95], 0.045, 0.16, 'triangle', 0.21); break;
      case 'potion':
        run([72, 76, 79, 84, 88], 0.075, 0.25, 'triangle');
        n(0.45, 0.045, 6000); break;
      case 'levelup':
        run([72, 76, 79, 84, 88, 91, 96], 0.07, 0.28);
        [72, 76, 79].forEach(m => p(hz(m), hz(m), 0.5, 0.09, 'triangle', 0.42)); break;
      case 'checkpoint':
        run([69, 76, 81, 85, 88], 0.09, 0.3, 'triangle');
        p(220, 440, 0.5, 0.07, 'sawtooth', 0, 1800); break;
      case 'roar':
        [0, 0.09, 0.2, 0.34].forEach((d, i) => {
          p(75 + i * 11, 29 + i * 3, 1.55 - d, 0.12, 'sawtooth', d, 850);
        });
        n(1.65, 0.28, 550, 0, 'bandpass', 180); break;
      case 'fire':
        n(1.1, 0.31, 3200, 0, 'lowpass', 700);
        n(0.85, 0.14, 650, 0.12, 'bandpass', 1800);
        p(58, 34, 0.95, 0.17, 'sawtooth', 0, 900); break;
      case 'boss_die':
        for (let i = 0; i < 5; i++) {
          const d = i * 0.18;
          n(0.8, 0.25 - i * 0.025, 2600, d, 'lowpass', 100);
          p(110 - i * 13, 24, 0.75, 0.2, 'sawtooth', d, 900);
        }
        p(48, 22, 1.8, 0.26, 'triangle');
        run([76, 71, 68, 64, 57, 52], 0.15, 0.22, 'square', 0.08); break;
      // ---- スタイルランク・コンボ・とどめ ----
      case 'rankup':       // ランクが上がった: 短く駆け上がる 3 音
        run([81, 88, 93], 0.045, 0.17, 'triangle'); break;
      case 'combo10':      // 10 コンボごと: きらっと光る 4 音
        run([88, 91, 95, 100], 0.035, 0.13, 'triangle');
        n(0.12, 0.05, 7000); break;
      case 'finish':       // ボスへのとどめ: 低い一撃と、高く伸びる光
        n(0.5, 0.3, 4200, 0, 'lowpass', 160);
        p(140, 32, 0.6, 0.3, 'triangle');
        p(660, 1980, 0.5, 0.1, 'triangle', 0.05);
        run([76, 83, 88, 95], 0.06, 0.16, 'triangle'); break;
      case 'deny':
        p(110, 100, 0.11, 0.16, 'square', 0, 1000);
        p(110, 90, 0.13, 0.16, 'square', 0.14, 1000); break;
      // ---- 中ボス（黒瀬 龍士）----
      case 'shutter':      // カメラのシャッター: カシャッ（幕が開いて閉じる 2 つの音）と、フラッシュの高い光
        n(0.014, 0.3, 3000); p(2400, 1700, 0.022, 0.1, 'square');
        p(160, 70, 0.08, 0.2, 'triangle');
        n(0.022, 0.26, 2200, 0.065); p(1900, 1300, 0.02, 0.08, 'square', 0.065);
        p(3200, 5200, 0.14, 0.06, 'triangle', 0.02); break;
      case 'guard':        // ガード: 鈍い受け止めと、短い金属音
        p(210, 120, 0.09, 0.26, 'triangle');
        n(0.05, 0.16, 1500, 0, 'bandpass', 900);
        p(1900, 1500, 0.11, 0.07, 'triangle', 0.01); break;
      case 'wave':         // 衝撃掌打: 空気を押し出す低い音と、うなり
        n(0.5, 0.26, 600, 0, 'bandpass', 2400);
        p(90, 300, 0.35, 0.2, 'sawtooth', 0, 1200);
        p(520, 180, 0.4, 0.1, 'triangle', 0.03); break;
    }
  }

  const effects = new Set([
    'shutter', 'guard', 'wave', 'rankup', 'combo10', 'finish',
    'select', 'start', 'jump', 'djump', 'land', 'dash',
    'slash_red1', 'slash_red2', 'slash_red3', 'slash_blue1', 'slash_blue2', 'slash_blue3',
    'hit', 'hit_heavy', 'special_red', 'special_blue', 'switch', 'cross',
    'hurt', 'enemy_shot', 'enemy_die', 'explosion', 'pickup', 'potion',
    'levelup', 'checkpoint', 'roar', 'fire', 'boss_die', 'deny'
  ]);

  // 斬撃とヒットの音は別モジュール（window.REBELL_SLASH）が担当する。無いときは近い音で代用する。
  const slashFallback = {
    slash_blue4: 'slash_blue3', slam_red: 'land', hit_red: 'hit_heavy', hit_red_heavy: 'hit_heavy',
    hit_blue: 'hit', hit_blue_heavy: 'hit_heavy'
  };
  function sfx(name, opt) {
    if (!running() || muted || volume === 0) return;
    const S = window.REBELL_SLASH;
    const viaSlash = !!(S && S.names && S.names.indexOf(name) >= 0 && fx && !fx.retiring);
    if (!viaSlash) name = slashFallback[name] || name;
    if (!viaSlash && !effects.has(name)) return;
    const t = ctx.currentTime;
    if (lastSfx.has(name) && t - lastSfx.get(name) < 0.03) return;
    lastSfx.set(name, t);
    if (viaSlash) S.play(ctx, fx.bus, name, t + 0.003, opt);
    else effect(name, t + 0.003);
  }

  function setMuted(value) {
    muted = !!value;
    if (ctx && master) ramp(master.gain, muted ? 0 : volume, 0.015);
    if (!muted) wake();
  }

  function setVolume(value) {
    if (!Number.isFinite(value)) return;
    volume = clamp(value, 0, 1);
    if (ctx && master) ramp(master.gain, muted ? 0 : volume, 0.015);
  }

  document.addEventListener('visibilitychange', safe(wake));
  window.addEventListener('pageshow', safe(wake));
  window.REBELL_AUDIO = Object.freeze({
    init: safe(init),
    playBgm: safe(playBgm),
    stopBgm: safe(stopBgm),
    sfx: safe(sfx),
    setMuted: safe(setMuted),
    isMuted: () => muted,
    setVolume: safe(setVolume)
  });
})();
