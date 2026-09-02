let audioContext = null;
const speechTimers = new Set();

// Ensure voices are loaded asynchronously across all browsers
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    // warm up voices cache
    window.speechSynthesis.getVoices();
  };
}

export function getSoundsEnabled() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('lotisec-sounds') !== 'off';
}

export function setSoundsEnabled(enabled) {
  localStorage.setItem('lotisec-sounds', enabled ? 'on' : 'off');
  if (enabled) unlockSound();
}

export function getVoiceProfile() {
  if (typeof window === 'undefined') return 'africaine';
  const stored = localStorage.getItem('lotisec-voice-profile') || 'africaine';
  return stored === 'operationnelle' ? 'africaine' : stored;
}

export function setVoiceProfile(profile) {
  localStorage.setItem('lotisec-voice-profile', profile);
}

export function stopOperationalAudio() {
  speechTimers.forEach((timer) => clearTimeout(timer));
  speechTimers.clear();
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

function getContext() {
  if (!getSoundsEnabled()) return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

export function unlockSound() {
  try {
    const context = getContext();
    if (context?.state === 'suspended') context.resume();
  } catch {}
}

function tone(frequency, start, duration, { type = 'sine', gain = 0.06, endFrequency = frequency } = {}) {
  const context = getContext();
  if (!context) return;
  try {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), context.currentTime + start + duration);
    volume.gain.setValueAtTime(0.0001, context.currentTime + start);
    volume.gain.exponentialRampToValueAtTime(gain, context.currentTime + start + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(context.currentTime + start);
    oscillator.stop(context.currentTime + start + duration + 0.02);
  } catch {}
}

export function playEmergencyAlert() {
  unlockSound();
  [0, 0.24, 0.48].forEach((start) => {
    tone(760, start, 0.1, { type: 'square', gain: 0.052 });
    tone(1120, start + 0.11, 0.1, { type: 'square', gain: 0.058 });
  });
  tone(1360, 0.73, 0.22, { type: 'triangle', gain: 0.065, endFrequency: 680 });
}

export function playTargetLock() {
  unlockSound();
  tone(420, 0, 0.1, { type: 'sine', gain: 0.035, endFrequency: 820 });
  tone(880, 0.11, 0.12, { type: 'triangle', gain: 0.04, endFrequency: 1180 });
}

export function playMapExpand() {
  unlockSound();
  tone(260, 0, 0.14, { type: 'sine', gain: 0.03, endFrequency: 520 });
  tone(520, 0.09, 0.18, { type: 'triangle', gain: 0.035, endFrequency: 980 });
}

export function playDispatchConfirmation() {
  unlockSound();
  tone(460, 0, 0.12, { type: 'sine', gain: 0.035, endFrequency: 680 });
  tone(680, 0.11, 0.14, { type: 'triangle', gain: 0.04, endFrequency: 920 });
  tone(920, 0.25, 0.2, { type: 'sine', gain: 0.045, endFrequency: 1180 });
}

function preferredFrenchVoice(profile = getVoiceProfile()) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const frenchVoices = voices.filter((voice) => String(voice.lang).toLowerCase().startsWith('fr'));
  const africanLocales = ['fr-tg', 'fr-bj', 'fr-ci', 'fr-sn', 'fr-cm', 'fr-cd', 'fr-ma', 'fr-dz', 'fr-tn'];
  const africanNames = ['afrique', 'africa', 'dakar', 'abidjan', 'awa', 'aminata', 'mariam', 'fatou'];
  const african = frenchVoices.filter(
    (voice) => africanLocales.includes(String(voice.lang).toLowerCase()) || africanNames.some((name) => voice.name.toLowerCase().includes(name))
  );
  const preferred = ['denise', 'audrey', 'hortense', 'julie', 'marie', 'amélie', 'amelie', 'virginie', 'google français', 'google francais', 'microsoft paul', 'microsoft hortense'];

  if (profile === 'systeme') return frenchVoices[0] || voices[0] || null;
  const ranked = preferred.map((name) => frenchVoices.find((voice) => voice.name.toLowerCase().includes(name))).filter(Boolean);

  return (
    (profile === 'calme' ? african[1] : african[0]) ||
    african[0] ||
    (profile === 'calme' ? ranked[1] : ranked[0]) ||
    ranked[0] ||
    frenchVoices[0] ||
    voices[0] ||
    null
  );
}

export function getAfricanVoiceInfo() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return { available: false, name: null, lang: null };
  const locales = ['fr-tg', 'fr-bj', 'fr-ci', 'fr-sn', 'fr-cm', 'fr-cd', 'fr-ma', 'fr-dz', 'fr-tn'];
  const names = ['afrique', 'africa', 'dakar', 'abidjan', 'awa', 'aminata', 'mariam', 'fatou'];
  const voice = window.speechSynthesis
    .getVoices()
    .find((item) => locales.includes(String(item.lang).toLowerCase()) || names.some((name) => item.name.toLowerCase().includes(name)));
  return { available: Boolean(voice), name: voice?.name || null, lang: voice?.lang || null };
}

export function speakOperational(message, { delay = 0, rate, pitch, interrupt = true } = {}) {
  if (!getSoundsEnabled() || typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  const timer = setTimeout(() => {
    speechTimers.delete(timer);
    try {
      if (interrupt) window.speechSynthesis.cancel();
      const profile = getVoiceProfile();
      const preset = profile === 'calme' ? { rate: 0.86, pitch: 1.01 } : profile === 'systeme' ? { rate: 1, pitch: 1 } : { rate: 0.94, pitch: 1.04 };
      const utterance = new window.SpeechSynthesisUtterance(message);
      utterance.rate = rate ?? preset.rate;
      utterance.pitch = pitch ?? preset.pitch;
      utterance.volume = 0.95;
      const voice = preferredFrenchVoice(profile);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'fr-FR';
      } else {
        utterance.lang = 'fr-FR';
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[Speech] Synthesis error:', e);
    }
  }, delay);
  speechTimers.add(timer);
}

export function announceNewIncident(incident) {
  playEmergencyAlert();
  const victims = Number(incident?.victims) || 1;
  const location = incident?.location || 'position transmise';
  const severity = String(incident?.severity || 'prioritaire').toLowerCase();
  speakOperational(`Nouvelle urgence ${severity} signalée à ${location}. ${victims} victime${victims > 1 ? 's' : ''} signalée${victims > 1 ? 's' : ''}.`, {
    delay: 1050,
    rate: 0.94,
  });
}

export function announceAmbulanceAssignment({ ambulanceId, location, eta }) {
  playDispatchConfirmation();
  speakOperational(
    `Ambulance ${ambulanceId || ''} affectée. Départ vers ${location || 'le lieu de l’incident'}. Itinéraire calculé, arrivée estimée dans ${eta || 'quelques'} minutes.`,
    { delay: 520, rate: 0.95 }
  );
}

export function announceCongestion({ road, eta }) {
  playEmergencyAlert();
  speakOperational(
    `Trafic dense détecté${road ? ` sur ${road}` : ''}. Un itinéraire de dégagement plus fluide est activé${eta ? `. Nouveau temps estimé : ${eta} minutes` : ''}.`,
    { delay: 980, rate: 0.94 }
  );
}

export function announcePreDepartureDecision({ ambulanceId, road, route, eta }) {
  playEmergencyAlert();
  speakOperational(
    `Attention. Ralentissement détecté${road ? ` sur ${road}` : ''}. L'ambulance ${ambulanceId || ''} reste à l'arrêt pendant l'analyse. Itinéraire alternatif recommandé${route ? ` par ${route}` : ''}${eta ? `. Temps estimé : ${eta} minutes` : ''}. Départ autorisé après confirmation.`,
    { delay: 980, rate: 0.92 }
  );
}

export function announceOrientationConfirmation({ hospitalName, beds }) {
  playDispatchConfirmation();
  speakOperational(`Orientation confirmée vers ${hospitalName || 'le centre hospitalier'}${beds ? `. ${beds} places d'accueil disponibles.` : '.'}`, {
    delay: 300,
    rate: 0.95,
  });
}

export function announceMissionStage({ status, stage, ambulanceId, hospital }) {
  const currentStage = status || stage || '';
  const messages = {
    'Analyse trafic': `Ambulance ${ambulanceId || ''} en analyse du trafic avant départ.`,
    'Affectée': `Ambulance ${ambulanceId || ''} affectée et prête au départ.`,
    'En route': `Ambulance ${ambulanceId || ''} en route vers le lieu de l'urgence.`,
    'Sur place': `Ambulance ${ambulanceId || ''} arrivée sur place. Début de la prise en charge.`,
    'Orientation hospitalière': `Orientation hospitalière requise. ${hospital ? `${hospital} est recommandé selon les lits disponibles.` : ''}`,
    'Vers le centre de santé': `Prise en charge terminée. Départ du véhicule vers ${hospital || 'le centre hospitalier'}.`,
    'Pris en charge': `Victime arrivée à ${hospital || 'destination'}. Prise en charge hospitalière confirmée.`,
    'Terminée': 'Mission clôturée avec succès. Le rapport opérationnel est disponible.',
  };

  if (messages[currentStage]) {
    speakOperational(messages[currentStage], { delay: 180, rate: 0.93 });
  }
}
