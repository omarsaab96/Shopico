interface AlertItem {
  _id: string;
  title: { en: string; ar: string };
  body: { en: string; ar: string };
}

export class NotificationAlerts {
  private audio: AudioContext | null = null;
  private desktop = new Set<Notification>();

  async unlock() {
    if (!this.audio || this.audio.state === "closed") this.audio = new AudioContext();
    if (this.audio.state === "suspended") await this.audio.resume();
  }

  async play() {
    await this.unlock();
    const audio = this.audio!;
    // A short two-note chime with a smooth envelope avoids clicks.
    for (const [offset, frequency] of [[0, 880], [0.18, 1174]]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + offset;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    }
  }

  show(item: AlertItem, lang: "en" | "ar", onClick: () => void) {
    if (!("Notification" in window) || Notification.permission !== "granted" ||
      (document.visibilityState === "visible" && document.hasFocus())) return;
    try {
      const notification = new Notification(item.title[lang], {
        body: item.body[lang], icon: "/shopico_logo.png", tag: item._id,
        // The app chime follows the speaker setting; avoid a second OS sound.
        silent: true,
      });
      this.desktop.add(notification);
      notification.onclick = () => { window.focus(); notification.close(); onClick(); };
      notification.onclose = () => this.desktop.delete(notification);
    } catch { /* Unsupported browser/OS settings must not interrupt the event stream. */ }
  }

  clearDesktop() {
    for (const notification of this.desktop) notification.close();
    this.desktop.clear();
  }

  dispose() {
    this.clearDesktop();
    const audio = this.audio;
    this.audio = null;
    if (audio && audio.state !== "closed") void audio.close().catch(() => {});
  }
}
