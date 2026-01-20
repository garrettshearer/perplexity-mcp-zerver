/**
 * Tool implementation for chat functionality with Perplexity
 */

import crypto from "node:crypto";
import type { ChatMessage, PuppeteerContext } from "../types/index.js";
import { extractChatId } from "../utils/extraction.js";
import { openPerplexityChat, openPerplexitySpace, switchModel } from "../utils/puppeteer.js";

/**
 * Handles chat interactions with conversation history.
 * Supports opening existing chats via URL or chat ID - the history is automatically
 * loaded from the URL, no message replay needed.
 *
 * Precedence: chat_url > chat_id > space_id
 * - If chat_url or chat_id provided, space_id is ignored (existing conversation)
 * - If only space_id provided (no chat_url/chat_id), navigate to space for new chat
 */
export default async function chatPerplexity(
  args: { message: string; chat_id?: string; chat_url?: string; space_id?: string; model?: string },
  ctx: PuppeteerContext,
  performSearch: (prompt: string, ctx: PuppeteerContext) => Promise<string>,
  getChatHistory: (chat_id: string) => ChatMessage[],
  saveChatMessage: (chat_id: string, message: ChatMessage) => void,
): Promise<string> {
  const { message, chat_id, chat_url, space_id, model } = args;

  // Precedence: chat_url > chat_id > space_id (FR-007)
  // Extract chat ID from URL or use raw chat_id
  let resolvedChatId: string | null = null;
  let isExistingChat = false;

  if (chat_url) {
    resolvedChatId = extractChatId(chat_url);
    if (!resolvedChatId) {
      throw new Error(`Invalid chat URL format: ${chat_url}`);
    }
    isExistingChat = true;
  } else if (chat_id) {
    resolvedChatId = extractChatId(chat_id);
    if (!resolvedChatId) {
      throw new Error(`Invalid chat ID format: ${chat_id}`);
    }
    isExistingChat = true;
  } else {
    // New conversation - generate fresh UUID
    resolvedChatId = crypto.randomUUID();
    isExistingChat = false;
  }

  // For existing chats, navigate to the chat URL
  // The history is pre-loaded by the URL - no replay needed (SC-005)
  if (isExistingChat) {
    await openPerplexityChat(ctx, resolvedChatId);
    // T015/FR-009: Switch model if specified (before sending message)
    if (model) {
      await switchModel(ctx, model);
    }
    // For existing chats, just send the new message without history prefix
    return await performSearch(message, ctx);
  }

  // T045: For NEW chats with space_id, navigate to space first
  // (space_id is only used for new conversations, ignored for existing chats)
  if (space_id) {
    await openPerplexitySpace(ctx, space_id);
  }

  // T015/FR-009: Switch model if specified (before executing chat)
  if (model) {
    await switchModel(ctx, model);
  }

  // For new conversations, build history context
  const history = getChatHistory(resolvedChatId);
  const userMessage: ChatMessage = { role: "user", content: message };
  saveChatMessage(resolvedChatId, userMessage);

  let conversationPrompt = "";
  for (const msg of history) {
    conversationPrompt +=
      msg.role === "user" ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
  }
  conversationPrompt += `User: ${message}\n`;

  return await performSearch(conversationPrompt, ctx);
}
