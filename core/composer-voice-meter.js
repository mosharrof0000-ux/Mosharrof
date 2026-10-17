/**
 * Live microphone activity meter for the existing composer voice button.
 * Only the microphone SVG reacts to measured input; the button surface stays neutral.
 */
export function initializeComposerVoiceMeter(button) {
  if (!button || button.dataset.mosharrofVoiceMeterReady === "true") return;
  button.dataset.mosharrofVoiceMeterReady = "true";
  let context = null;
  let analyser = null;
  let source = null;
  let silentGain = null;
  let frame = 0;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (source) { try { source.disconnect(); } catch {} }
    if (analyser) { try { analyser.disconnect(); } catch {} }
    if (silentGain) { try { silentGain.disconnect(); } catch {} }
    source = null;
    analyser = null;
    silentGain = null;
    button.classList.remove("has-voice-activity");
    if (context) {
      const previous = context;
      context = null;
      if (previous.state !== "closed") previous.close().catch(() => {});
    }
  }

  function start(stream) {
    stop();
    if (!stream || !stream.getAudioTracks().some(track => track.readyState === "live")) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    try {
      context = new AudioContextCtor();
      analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      source = context.createMediaStreamSource(stream);
      silentGain = context.createGain();
      silentGain.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silentGain);
      silentGain.connect(context.destination);
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!context || !analyser || !stream.getAudioTracks().some(track => track.readyState === "live")) {
          stop();
          return;
        }
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (let i = 0; i < samples.length; i++) {
          const sample = (samples[i] - 128) / 128;
          energy += sample * sample;
        }
        button.classList.toggle("has-voice-activity", Math.sqrt(energy / samples.length) >= 0.025);
        frame = requestAnimationFrame(tick);
      };
      if (context.state === "suspended") context.resume().catch(() => {});
      tick();
    } catch (error) {
      stop();
      console.warn("Voice activity meter unavailable", error);
    }
  }

  document.addEventListener("vm", event => start(event.detail));
}
