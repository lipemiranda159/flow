export type ApplicationEvent = {
  id: string;
  level: "info" | "warn" | "error";
  event: string;
  context: Record<string, unknown>;
  createdAt: Date;
};
