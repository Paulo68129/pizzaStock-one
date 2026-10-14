export type SoundType = 'bell' | 'chime' | 'doorbell' | 'marimba';

export interface NotificationSettings {
  enabled: boolean;
  volume: number;
  sound: SoundType;
}

const STORAGE_KEY = 'pizzastock_notification_settings';

export const soundLabels: Record<SoundType, string> = {
  bell: 'Campainha Clássica',
  chime: 'Ding Suave',
  doorbell: 'Campainha de Porta',
  marimba: 'Marimba',
};

export const soundOptions: SoundType[] = ['bell', 'chime', 'doorbell', 'marimba'];

export function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
      return {
        enabled: parsed.enabled ?? true,
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.7,
        sound: parsed.sound ?? 'bell',
      };
    }
  } catch {
    // ignore parse errors
  }
  return { enabled: true, volume: 0.7, sound: 'bell' };
}

export function saveSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

interface ToneConfig {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

function playTones(ctx: AudioContext, masterGain: GainNode, tones: ToneConfig[], volume: number) {
  const now = ctx.currentTime;
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.freq;

    const peakGain = (tone.gain ?? 0.5) * volume;
    const startTime = now + tone.start;
    const endTime = startTime + tone.duration;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(endTime + 0.05);
  }
}

const soundConfigs: Record<SoundType, (ctx: AudioContext, masterGain: GainNode, volume: number) => void> = {
  bell: (ctx, masterGain, volume) => {
    playTones(ctx, masterGain, [
      { freq: 880, start: 0, duration: 0.4, type: 'sine', gain: 0.6 },
      { freq: 660, start: 0.15, duration: 0.5, type: 'sine', gain: 0.4 },
      { freq: 880, start: 0.6, duration: 0.4, type: 'sine', gain: 0.5 },
      { freq: 660, start: 0.75, duration: 0.5, type: 'sine', gain: 0.35 },
    ], volume);
  },
  chime: (ctx, masterGain, volume) => {
    playTones(ctx, masterGain, [
      { freq: 1318.51, start: 0, duration: 0.6, type: 'sine', gain: 0.5 },
      { freq: 1567.98, start: 0.2, duration: 0.6, type: 'sine', gain: 0.4 },
      { freq: 2093.00, start: 0.4, duration: 0.8, type: 'sine', gain: 0.35 },
    ], volume);
  },
  doorbell: (ctx, masterGain, volume) => {
    playTones(ctx, masterGain, [
      { freq: 659.25, start: 0, duration: 0.25, type: 'square', gain: 0.3 },
      { freq: 523.25, start: 0.25, duration: 0.25, type: 'square', gain: 0.3 },
      { freq: 659.25, start: 0.6, duration: 0.25, type: 'square', gain: 0.3 },
      { freq: 523.25, start: 0.85, duration: 0.25, type: 'square', gain: 0.3 },
    ], volume);
  },
  marimba: (ctx, masterGain, volume) => {
    playTones(ctx, masterGain, [
      { freq: 523.25, start: 0, duration: 0.15, type: 'triangle', gain: 0.6 },
      { freq: 659.25, start: 0.12, duration: 0.15, type: 'triangle', gain: 0.5 },
      { freq: 783.99, start: 0.24, duration: 0.15, type: 'triangle', gain: 0.45 },
      { freq: 1046.50, start: 0.36, duration: 0.3, type: 'triangle', gain: 0.4 },
      { freq: 783.99, start: 0.6, duration: 0.15, type: 'triangle', gain: 0.4 },
      { freq: 1046.50, start: 0.72, duration: 0.4, type: 'triangle', gain: 0.35 },
    ], volume);
  },
};

export function playNotificationSound(settings: NotificationSettings): boolean {
  if (!settings.enabled) {
    console.log('[NOTIFICATION SOUND] Disabled by settings, skipping');
    return false;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    console.warn('[NOTIFICATION SOUND] Web Audio API not available');
    return false;
  }

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const masterGain = ctx.createGain();
  masterGain.gain.value = settings.volume;
  masterGain.connect(ctx.destination);

  const playFn = soundConfigs[settings.sound] ?? soundConfigs.bell;
  playFn(ctx, masterGain, settings.volume);

  console.log('[NOTIFICATION SOUND] Played', {
    sound: settings.sound,
    volume: settings.volume,
    timestamp: new Date().toISOString(),
  });
  return true;
}

let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  unlocked = true;
  console.log('[NOTIFICATION SOUND] Audio context unlocked by user interaction');
}
