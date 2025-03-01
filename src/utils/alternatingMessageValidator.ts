import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import logger from "./logger";

export interface MessageValidationRules {
    requireAlternating?: boolean;
    firstMessageType?: typeof HumanMessage | typeof AIMessage;
    allowSystem?: boolean;
}

export class AlternatingMessageValidator {
    private rules: MessageValidationRules;
    private modelName: string;

    constructor(modelName: string, rules: MessageValidationRules) {
        this.rules = rules;
        this.modelName = modelName;
    }

    processMessages(messages: BaseMessage[]): BaseMessage[] {
        if (!this.rules.requireAlternating) {
            return messages;
        }

        const processedMessages: BaseMessage[] = [];
        
        for (let i = 0; i < messages.length; i++) {
            const currentMsg = messages[i];

            if (currentMsg instanceof SystemMessage) {
                if (this.rules.allowSystem) {
                    processedMessages.push(currentMsg);
                } else {
                    logger.warn(`${this.modelName}: Skipping system message - not allowed`);
                }
                continue;
            }

            if (processedMessages.length === 0 || 
                processedMessages[processedMessages.length - 1] instanceof SystemMessage) {
                if (this.rules.firstMessageType && 
                    !(currentMsg instanceof this.rules.firstMessageType)) {
                    logger.warn(`${this.modelName}: Converting first message to required type`);
                    processedMessages.push(new this.rules.firstMessageType({
                        content: currentMsg.content,
                        additional_kwargs: currentMsg.additional_kwargs
                    }));
                    continue;
                }
            }

            const lastMsg = processedMessages[processedMessages.length - 1];
            if (lastMsg instanceof HumanMessage && currentMsg instanceof HumanMessage) {
                logger.warn(`${this.modelName}: Skipping consecutive human message`);
                continue;
            }
            if (lastMsg instanceof AIMessage && currentMsg instanceof AIMessage) {
                logger.warn(`${this.modelName}: Skipping consecutive AI message`);
                continue;
            }

            if (this.modelName === 'deepseek-reasoner' && currentMsg instanceof AIMessage) {
                const { reasoning_content, ...cleanedKwargs } = currentMsg.additional_kwargs;
                processedMessages.push(new AIMessage({
                    content: currentMsg.content,
                    additional_kwargs: cleanedKwargs
                }));
            } else {
                processedMessages.push(currentMsg);
            }
        }

        return processedMessages;
    }
}

export const getMessageValidator = (modelName: string): AlternatingMessageValidator | null => {
    const validators: Record<string, MessageValidationRules> = {
        'deepseek-reasoner': {
            requireAlternating: true,
            firstMessageType: HumanMessage,
            allowSystem: true
        },
        // Add more model configurations as needed
    };

    const rules = validators[modelName];
    return rules ? new AlternatingMessageValidator(modelName, rules) : null;
};
