import type { PlatformAdapter } from "./platform-adapter.js";
import { WhatsAppAdapter } from "./whatsapp-adapter.js";
import { TelegramAdapter } from "./telegram-adapter.js";

/**
 * Factory para obter o adapter correto baseado no channel
 * Permite registrar novos adapters para novas plataformas
 */
export class AdapterFactory {
  private static adapters: Map<string, PlatformAdapter> = new Map([
    ["whatsapp", new WhatsAppAdapter()],
    ["telegram", new TelegramAdapter()]
  ]);

  /**
   * Obter adapter para um channel específico
   */
  static getAdapter(channel: string): PlatformAdapter {
    const adapter = this.adapters.get(channel.toLowerCase());
    if (!adapter) {
      throw new Error(`Platform adapter não encontrado para channel: ${channel}`);
    }
    return adapter;
  }

  /**
   * Registrar um novo adapter (útil para extensibilidade)
   */
  static registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.channel.toLowerCase(), adapter);
  }

  /**
   * Listar todos os channels suportados
   */
  static getSupportedChannels(): string[] {
    return Array.from(this.adapters.keys());
  }
}
