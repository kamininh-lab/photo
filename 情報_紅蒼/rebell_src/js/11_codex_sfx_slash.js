// Codex 担当: 斬撃とヒットの効果音（window.REBELL_SLASH）
/*
 * 構成（風切り・刃鳴り・胴・アタック）は Codex。
 * 明るさ（風切りの帯域、刃鳴りの高さと音量、ヒットの割れる成分）は、ブラウザの OfflineAudioContext に
 * 描き出して測りながら Claude が調整した。試聴はしていない。
 */
(function () {
  'use strict';

  const noiseCache = new WeakMap();
  const EPS = 0.00001;
  const own = Object.prototype.hasOwnProperty;
  // wind=風切りの帯域 [始め, 山, 終わり]Hz / cut=高域の上限 / blade=刃鳴りの高さ / ring=刃鳴りの音量 / body=低い胴
  const swings = {
    // 紅: 大鎌。太い風切りに、重い刃鳴りと低い胴を重ねる
    slash_red1: { d: 0.34, wind: [520, 3300, 420], air: 0.36, cut: 9500, blade: 1620, ring: 0.105, body: 77, weight: 0.17, edge: 420, punch: 0.24, metal: 3 },
    slash_red2: { d: 0.36, wind: [420, 3900, 950], air: 0.35, cut: 10000, blade: 1840, ring: 0.10, body: 85, weight: 0.16, edge: 470, punch: 0.24, metal: 3, rise: true },
    slash_red3: { d: 0.42, wind: [420, 3700, 300], air: 0.38, cut: 9500, blade: 1440, ring: 0.115, body: 66, weight: 0.19, edge: 380, punch: 0.26, metal: 3 },
    slam_red: { d: 0.34, slam: true, body: 112, weight: 0.43, edge: 300, punch: 0.30 },      // 大鎌が地面を打つ音（振りの音とは別に、着地の瞬間に鳴らす）
    // 蒼: 刀。高く鋭い風切りと、はっきりした刃鳴り
    slash_blue1: { d: 0.115, wind: [2600, 8400, 3000], air: 0.27, cut: 15000, blade: 3900, ring: 0.085, edge: 2300, punch: 0.20, metal: 3 },
    slash_blue2: { d: 0.12, wind: [3000, 9200, 3600], air: 0.27, cut: 15000, blade: 4350, ring: 0.085, edge: 2600, punch: 0.20, metal: 3 },
    slash_blue3: { d: 0.14, wind: [3400, 10000, 4800], air: 0.26, cut: 16000, blade: 4800, ring: 0.08, edge: 2900, punch: 0.20, metal: 3, thrust: true },
    slash_blue4: { d: 0.26, wind: [2200, 7800, 2200], air: 0.28, cut: 15000, blade: 3450, ring: 0.125, edge: 2100, punch: 0.22, metal: 3 }
  };
  // crackF=当たった瞬間の割れる音の帯域 / crackV=その音量 / sweep=続く下降スイープ
  const impacts = {
    hit_red: { d: 0.27, edge: 820, punch: 0.36, air: 0.40, crackV: 1.3, crackF: [7200, 3600, 1700], crackD: 0.028, sweep: [3300, 1500, 320], cut: 12000, cut2: 8000, blade: 1500, ring: 0.10, body: 91, weight: 0.26, metal: 3 },
    hit_red_heavy: { d: 0.44, edge: 700, punch: 0.38, air: 0.42, crackV: 1.3, crackF: [7000, 3200, 1500], crackD: 0.034, sweep: [3000, 1300, 260], cut: 12000, cut2: 8000, blade: 1280, ring: 0.11, body: 80, weight: 0.29, metal: 3, heavy: true },
    hit_blue: { d: 0.10, edge: 2500, punch: 0.22, air: 0.24, crackV: 1.15, crackF: [10000, 6000, 3000], crackD: 0.022, sweep: [5600, 2600, 1000], cut: 16000, cut2: 12000, blade: 4200, ring: 0.075, metal: 3 },
    hit_blue_heavy: { d: 0.18, edge: 2200, punch: 0.24, air: 0.27, crackV: 1.1, crackF: [9500, 5200, 2600], crackD: 0.026, sweep: [5000, 2200, 800], cut: 16000, cut2: 12000, blade: 3600, ring: 0.11, metal: 3 },
    hit: { d: 0.16, edge: 1300, punch: 0.32, air: 0.26, crackV: 0.9, crackF: [8000, 4000, 2000], sweep: [4200, 1700, 420], cut: 12000, cut2: 9000, blade: 2300, ring: 0.07, body: 115, weight: 0.15, metal: 2 },
    hit_heavy: { d: 0.28, edge: 1050, punch: 0.35, air: 0.29, crackV: 0.95, crackF: [7500, 3600, 1700], sweep: [3600, 1500, 340], cut: 12000, cut2: 9000, blade: 1800, ring: 0.085, body: 101, weight: 0.21, metal: 3 }
  };
  const names = Object.freeze(Object.keys(swings).concat(Object.keys(impacts)));

  // 通常域は無加工。瞬間的な大振幅だけを緩く抑える。
  function makeCurve(knee, limit) {
    const curve = new Float32Array(4097);
    const width = limit - knee;
    for (let i = 0; i < curve.length; i++) {
      const x = i / (curve.length - 1) * 2 - 1;
      const a = Math.abs(x);
      const y = a <= knee ? a : knee + width * (1 - Math.exp(-(a - knee) / width));
      curve[i] = Math.sign(x) * y;
    }
    return curve;
  }
  const safetyCurve = makeCurve(0.48, 0.58);
  const blueCurve = makeCurve(0.34, 0.39);

  function random(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let x = Math.imul(state ^ (state >>> 15), state | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seeded(seed) {
    if (typeof seed !== 'number' || !Number.isFinite(seed)) return Math.random;
    const s = String(seed);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return random(h);
  }

  // キャッシュの内容を呼び出し順や opt.seed に依存させない。
  function noise(ctx) {
    let buffer = noiseCache.get(ctx);
    if (buffer) return buffer;
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const rng = random(0x52454245);
    let mean = 0;
    for (let i = 0; i < data.length; i++) {
      data[i] = rng() * 2 - 1;
      mean += data[i];
    }
    mean /= data.length;
    for (let i = 0; i < data.length; i++) data[i] -= mean;
    noiseCache.set(ctx, buffer);
    return buffer;
  }

  function disconnect(node) {
    try { node.disconnect(); } catch (_) {}
  }

  function envelope(param, t, d, level, attack, hold) {
    const a = Math.min(attack, d * 0.20);
    const h = Math.min(a + (hold || 0), d * 0.65);
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(level, t + a);
    param.setValueAtTime(level, t + h);
    param.exponentialRampToValueAtTime(Math.max(EPS, level * 0.004), t + d - 0.002);
    param.linearRampToValueAtTime(0, t + d);
  }

  function play(ctx, dest, name, when, opt) {
    const nodes = [];
    const sources = [];
    let t = 0;
    let end = 0;
    let live = 0;
    let cleaned = false;

    function keep(node) {
      nodes.push(node);
      return node;
    }

    function clean() {
      if (cleaned) return;
      cleaned = true;
      for (const node of nodes) disconnect(node);
      for (const source of sources) source.onended = null;
      nodes.length = 0;
      sources.length = 0;
    }

    try {
      const hit = typeof name === 'string' && own.call(impacts, name);
      if (!hit && !(typeof name === 'string' && own.call(swings, name))) return 0;
      if (!ctx || !dest || !Number.isFinite(when) || when < 0) return 0;
      if (ctx.state === 'closed' || dest.context !== ctx) return 0;
      t = when;
      opt = opt || {};
      const rng = seeded(opt.seed);
      const step = Number.isFinite(opt.step) ? Math.max(0, Math.min(12, Math.trunc(opt.step))) : 0;
      const pitch = 0.94 + rng() * 0.12;
      const combo = hit ? Math.pow(2, step / 20) : 1;      // コンボ 12 で約 1.5 倍の高さ
      const p = hit ? impacts[name] : swings[name];
      const mix = keep(ctx.createGain());
      const safety = keep(ctx.createWaveShaper());
      mix.gain.setValueAtTime(1, t);
      safety.curve = name.indexOf('blue') !== -1 ? blueCurve : safetyCurve;
      safety.oversample = 'none';
      mix.connect(safety);
      safety.connect(dest);

      function frequency(value) {
        return Math.max(20, Math.min(ctx.sampleRate * 0.44, value));
      }

      function source(type) {
        if (sources.length >= 8) throw new Error('Voice limit');
        const s = keep(type === 'noise' ? ctx.createBufferSource() : ctx.createOscillator());
        sources.push(s);
        return s;
      }

      function schedule(s, branch, at, d, offset) {
        const start = t + at;
        const finish = start + d;
        live++;
        s.onended = function () {
          try {
            for (const n of branch) disconnect(n);
            s.onended = null;
            live--;
            if (live === 0) clean();
          } catch (_) {}
        };
        if (offset === undefined) s.start(start);
        else s.start(start, offset);
        s.stop(finish);
        end = Math.max(end, finish);
      }

      function tone(at, d, from, to, level, attack, hold, type) {
        const s = source('tone');
        const gain = keep(ctx.createGain());
        s.type = type || 'sine';
        s.frequency.setValueAtTime(frequency(from), t + at);
        s.frequency.exponentialRampToValueAtTime(frequency(to), t + at + d);
        envelope(gain.gain, t + at, d, level, attack || 0.001, hold);
        s.connect(gain);
        gain.connect(mix);
        schedule(s, [s, gain], at, d);
      }

      function air(at, d, points, level, q, attack, hold, cutoff) {
        const s = source('noise');
        const band = keep(ctx.createBiquadFilter());
        const low = keep(ctx.createBiquadFilter());
        const gain = keep(ctx.createGain());
        s.buffer = noise(ctx);
        s.loop = true;
        band.type = 'bandpass';
        band.Q.setValueAtTime(q, t + at);
        band.frequency.setValueAtTime(frequency(points[0]), t + at);
        band.frequency.exponentialRampToValueAtTime(frequency(points[1]), t + at + d * 0.23);
        band.frequency.exponentialRampToValueAtTime(frequency(points[2]), t + at + d);
        low.type = 'lowpass';
        low.Q.setValueAtTime(-3.0103, t + at);
        low.frequency.setValueAtTime(frequency(cutoff || 7600), t + at);
        envelope(gain.gain, t + at, d, level, attack || 0.001, hold);
        s.connect(band);
        band.connect(low);
        low.connect(gain);
        gain.connect(mix);
        schedule(s, [s, band, low, gain], at, d, rng() * 1.3);
      }

      function steel(at, d, base, level, count, rise) {
        const ratios = [1, 1.483, 2.137];
        const gains = [1, 0.60, 0.33];
        for (let i = 0; i < count; i++) {
          const f = base * ratios[i] * (0.994 + rng() * 0.012);
          const length = d * (1 - i * 0.13);
          tone(at, length, f, f * (rise ? 1.09 : 0.86), level * gains[i], 0.0006);
        }
      }

      // 短い刃先の芯。ほかの層より先に鳴らし、連打でも輪郭を残す。
      const edge = p.edge * pitch * combo;
      tone(0, 0.012, edge, edge * 0.58, p.punch, 0.00018, 0.002);

      if (p.slam) {
        // 地面を打つ音: 割れる成分のあとに、低い胴を残す。
        air(0.001, 0.12, [2400 * pitch, 900 * pitch, 180], 0.34, 0.65, 0.0008, 0, 6000);
        tone(0, p.d, p.body * pitch, Math.max(40, 42 * pitch), p.weight, 0.001, 0.010);
        return end;
      }
      if (!hit) {
        const windEnd = p.land ? 0.40 : p.d;
        const sweep = p.wind.map(f => f * pitch);
        air(0.003, windEnd - 0.003, sweep, p.air, p.thrust ? 1.15 : 0.65,
          0.002, p.thrust ? 0.008 : windEnd * 0.12, p.cut || (p.body ? 5000 : 7200));
        const ringAt = p.body ? 0.025 : 0.008;
        const ringTime = p.land ? 0.23 : p.d - ringAt;
        steel(ringAt, ringTime, p.blade * pitch, p.ring, p.metal, p.rise);
        if (p.body) {
          tone(0.004, windEnd - 0.004, p.body * 1.5 * pitch,
            p.body * (p.rise ? 1.12 : 0.72) * pitch, p.weight, 0.005, 0.018);
        }
        if (p.land) {
          // 0.36 秒で地面に到達。高域より低域を長く残す。
          air(0.36, 0.10, [820, 410, 140], 0.26, 0.65, 0.0008, 0, 2600);
          tone(0.36, p.d - 0.36, 112 * pitch, Math.max(40, 42 * pitch), 0.43, 0.001, 0.010);
        }
      } else {
        const red = name === 'hit_red' || name === 'hit_red_heavy';
        const blue = name === 'hit_blue' || name === 'hit_blue_heavy';
        const high = pitch * combo;
        // 3 ms で噛みつき、その直後から帯域を下降させる。
        air(0.003, p.crackD || 0.019, (p.crackF || [6100, 2800, 1500]).map(f => f * high),
          p.air * (p.crackV || 0.70), 0.55, 0.0003, 0, p.cut || (blue ? 7200 : 9000));
        air(0.004, p.d - 0.004,
          (p.sweep || [red ? 2200 : 3900, 1100, 270]).map(f => f * high),
          p.air, 0.72, 0.0006, 0.003, p.cut2 || (blue ? 6500 : 6000));
        steel(0.004, Math.min(p.d - 0.004, blue ? 0.12 : 0.19),
          p.blade * high, p.ring / Math.pow(combo, 0.25), p.metal, false);
        if (p.body) {
          // コンボで低音まで上げず、40〜120 Hz の胴を維持する。
          tone(0.003, p.d - 0.003, p.body * pitch,
            (red ? 43 : 59) * pitch, p.weight, 0.001, red ? 0.018 : 0.004);
        }
        if (p.heavy) {
          tone(0.009, p.d - 0.009, 58 * pitch, Math.max(40, 40 * pitch), 0.16, 0.004, 0.035);
        }
      }
      return end;
    } catch (_) {
      // 途中で失敗しても、予約済みの音と接続を残さない。
      for (const s of sources) {
        try { s.stop(t); } catch (_) {}
      }
      try { clean(); } catch (_) {}
      return 0;
    }
  }

  window.REBELL_SLASH = Object.freeze({ names, play });
})();
