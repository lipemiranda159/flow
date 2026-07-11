export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type ConversationStatus = "active" | "waiting_input" | "completed" | "failed";

export type Conversation = {
  id: string;
  externalUserId: string;
  channel: string;
  flowId: string;
  flowVersion: number;
  currentStepId: string | null;
  waitingInputStepId: string | null;
  status: ConversationStatus;
  variables: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type OutputAction = {
  type: "send_message";
  text: string;
};
