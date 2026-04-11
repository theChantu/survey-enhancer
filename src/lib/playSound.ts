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

function whenReady(audio: HTMLAudioElement): Promise<HTMLAudioElement> {
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA)
        return Promise.resolve(audio);

    return new Promise((resolve, reject) => {
        const onReady = () => {
            audio.removeEventListener("error", onError);
            resolve(audio);
        };
        const onError = () => {
            audio.removeEventListener("canplaythrough", onReady);
            reject(audio.error);
        };
        audio.addEventListener("canplaythrough", onReady, { once: true });
        audio.addEventListener("error", onError, { once: true });
    });
}

export async function playSound(settings: SoundSettings): Promise<void> {
    const { type, volume } = settings;

    const normalizedVolume = clampVolume(volume);
    if (normalizedVolume === 0) return;

    const source = await whenReady(getAudio(type));
    const audio = source.cloneNode() as HTMLAudioElement;
    audio.volume = normalizedVolume;
    audio.currentTime = 0;
    await audio.play();
}
