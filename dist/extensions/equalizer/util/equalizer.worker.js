import * as autoeq from './autoeq.js';

let inst = null;

// Initialize the WebAssembly module once
autoeq.make().then(module => {
  inst = module;
}).catch(err => {
  console.error("Failed to load autoeq WASM:", err);
});

self.onmessage = async function (e) {
  const { type, payload, id } = e.data;

  if (type === 'autoEQ') {
    try {
      if (!inst) {
        throw new Error("WASM module not loaded yet.");
      }

      const { source, target, options } = payload;

      // options from eq-autoeq.js:
      // maxFilters: this.currentEQBands,
      // freqRange: [freqMin, freqMax],
      // qRange: [qMin, qMax],
      // gainRange: [gainMin, gainMax],
      // useShelfFilter: useShelfFilter,

      const N = options.maxFilters || 10;

      // The autoeq WASM expects data on a strict 384-point log-spaced grid from 20Hz to 20kHz.
      // source and target from payload are array of [freq, db]

      // Helper to map array of [f, v] to flat array of f and v
      const unzip = (arr) => {
        return {
          f: arr.map(e => e[0]),
          v: arr.map(e => e[1])
        };
      };

      const sSrc = unzip(source);
      const sDst = unzip(target);

      // Resample onto internal autoeq.X grid
      const srcRaw = autoeq.interp(sSrc.f, sSrc.v);
      const dstRaw = autoeq.interp(sDst.f, sDst.v);

      if (!srcRaw.length || !dstRaw.length) {
        throw new Error("Interpolation failed: Check if data spans enough frequencies.");
      }

      // Configure specs manually if settings differ from default
      // autoeq-c's STANDARD config uses LSC and HSC by default at start and end
      let config = autoeq.CONFIGS.STANDARD(N);
      if (!options.useShelfFilter) {
        config.specs = Array(N).fill(null).map(() => ({ type: 0, f0: [20, 16000], gain: [-16, 16], q: [0.4, 4.0] }));
      }

      // Apply user constraints to all filters
      config.specs.forEach(spec => {
        spec.f0 = options.freqRange || [20, 20000];
        spec.gain = options.gainRange || [-12, 12];
        spec.q = options.qRange || [0.4, 4.0];
      });

      // Run AutoEQ (with Independent Error Smoothing)
      const res = autoeq.run(inst, dstRaw, srcRaw, config, autoeq.Smooth.IE);

      if (!res) {
        throw new Error("autoeq-c optimization failed to run.");
      }

      // Convert autoeq-c filter format to what modernGraphTool UI expects
      const filters = res.filters.map(f => {
        let t = "PK";
        if (f.type === "LSC") t = "LSQ";
        if (f.type === "HSC") t = "HSQ";

        return {
          type: t,
          freq: Math.round(f.f0 * 10) / 10,
          q: Math.round(f.q * 100) / 100,
          gain: Math.round(f.gain * 10) / 10
        };
      });

      self.postMessage({ type: 'result', id, payload: { filters, meta: { amp: res.amp, loss: res.loss, time: res.time } } });
    } catch (error) {
      self.postMessage({ type: 'error', id, payload: { message: error.message } });
    }
  }
};
