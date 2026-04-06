import { sendExtensionMessage } from "@/messages/sendExtensionMessage";

import type {
    Message,
    MessageMap,
    MessageResponse,
    StoreMutationMessageType,
} from "@/messages/types";

export async function applyMutation<T extends StoreMutationMessageType>(
    type: T,
    data: MessageMap[T],
): Promise<MessageResponse<T>> {
    return await sendExtensionMessage({
        type,
        data,
    } as Message<T>);
}
