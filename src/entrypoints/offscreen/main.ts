import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { playSound } from "@/lib/playSound";

onExtensionMessage("play-sound", async ({ sound, volume }) => {
    await playSound({
        type: sound,
        volume: volume,
    });
});
