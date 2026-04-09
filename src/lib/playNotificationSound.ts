import type { NotificationSound } from "@/store/types";

type SoundSettings = {
    type: NotificationSound;
    volume: number;
};

const soundUrls: Record<NotificationSound, string> = {
    alert: browser.runtime.getURL("/sounds/alert.mp3"),
    bloop: browser.runtime.getURL("/sounds/bloop.mp3"),
    chime: browser.runtime.getURL("/sounds/chime.mp3"),
};

const audioCache = new Map<NotificationSound, HTMLAudioElement>();

function clampVolume(volume: number): number {
    return Math.min(1, Math.max(0, volume));
}

function getAudio(type: NotificationSound): HTMLAudioElement {
    const cached = audioCache.get(type);
    if (cached) return cached;

    const audio = new Audio(soundUrls[type]);
    audio.preload = "auto";
    audioCache.set(type, audio);
    return audio;
}

export async function playNotificationSound({
    type,
    volume,
}: SoundSettings): Promise<void> {
    const normalizedVolume = clampVolume(volume);
    if (normalizedVolume === 0) return;

    const audio = getAudio(type).cloneNode() as HTMLAudioElement;
    audio.volume = normalizedVolume;
    audio.currentTime = 0;
    await audio.play();
}
