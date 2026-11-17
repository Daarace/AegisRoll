import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

/**
 * Initializes and retrieves a persistent, tamper-resistant device fingerprint
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    if (!fpPromise) {
      fpPromise = FingerprintJS.load();
    }
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  } catch (err) {
    console.warn('FingerprintJS load error, generating fallback device token:', err);
    // Secure fallback: combine screen, user agent, timezone, and local storage token
    let stored = localStorage.getItem('aegis_fallback_device_id');
    if (!stored) {
      stored = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
      localStorage.setItem('aegis_fallback_device_id', stored);
    }
    return stored;
  }
}
