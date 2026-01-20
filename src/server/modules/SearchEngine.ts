/**
 * SearchEngine - Handles search operations and answer extraction
 * Focused, testable module for Perplexity search functionality
 */
import type { Page } from "puppeteer";
import type { IBrowserManager, ISearchEngine, SearchResult } from "../../types/index.js";
import { logError, logInfo, logWarn } from "../../utils/logging.js";
import { retryOperation, sendChatMessage } from "../../utils/puppeteer.js";
import { CONFIG } from "../config.js";

export class SearchEngine implements ISearchEngine {
  constructor(private readonly browserManager: IBrowserManager) {}

  // T011: Updated to return SearchResult with answer, url, and citations
  async performSearch(query: string): Promise<SearchResult> {
    // Set a global timeout for the entire operation with buffer for MCP
    const operationTimeout = setTimeout(() => {
      logError("Global operation timeout reached, initiating recovery...");
      this.browserManager.performRecovery().catch((err: unknown) => {
        logError("Recovery after timeout failed:", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, CONFIG.PAGE_TIMEOUT - CONFIG.MCP_TIMEOUT_BUFFER);

    try {
      // Ensure browser is ready
      if (!this.browserManager.isReady()) {
        logInfo("Browser not ready, initializing...");
        await this.browserManager.initialize();
      }

      // Reset idle timeout
      this.browserManager.resetIdleTimeout();

      // Use retry operation for the entire search process with increased retries
      const ctx = this.browserManager.getPuppeteerContext();
      
      return await retryOperation(ctx, async () => {
        logInfo(`Navigating to Perplexity for query: "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}"`);
        await this.browserManager.navigateToPerplexity();

        // Validate main frame is attached
        const page = this.browserManager.getPage();
        if (!page || page.mainFrame().isDetached()) {
          logError("Main frame is detached, will retry with new browser instance");
          throw new Error("Main frame is detached");
        }

        logInfo("Waiting for search input...");
        const selector = await this.browserManager.waitForSearchInput();
        if (!selector) {
          logError("Search input not found, taking screenshot for debugging");
          if (page) {
            await page.screenshot({ path: "debug_search_input_not_found.png", fullPage: true });
          }
          throw new Error("Search input not found");
        }

        logInfo(`Found search input with selector: ${selector}`);

        // Perform the search
        await this.executeSearch(page, selector, query);

        // Wait for and extract the answer with URL and citations
        const result = await this.waitForCompleteAnswer(page);
        
        // T011: Capture the page URL as chat_id (after search completes)
        const pageUrl = page.url();
        logInfo(`Search completed with URL: ${pageUrl}`);
        
        return {
          answer: result.answer,
          url: pageUrl,
          citations: result.citations,
        };
      }, CONFIG.MAX_RETRIES);
    } catch (error) {
      logError("Search operation failed after all retries:", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Get current URL even on error (may be useful for debugging)
      const page = this.browserManager.getPage();
      const errorUrl = page?.url() || "https://www.perplexity.ai";

      // Handle specific error cases with user-friendly messages
      if (error instanceof Error) {
        if (error.message.includes("detached") || error.message.includes("Detached")) {
          logError("Frame detachment detected, attempting recovery...");
          await this.browserManager.performRecovery();
          return {
            answer: "The search operation encountered a technical issue. Please try again with a more specific query.",
            url: errorUrl,
            citations: [],
          };
        }

        if (error.message.includes("timeout") || error.message.includes("Timed out")) {
          logError("Timeout detected, attempting recovery...");
          await this.browserManager.performRecovery();
          return {
            answer: "The search operation is taking longer than expected. This might be due to high server load. Your query has been submitted and we're waiting for results. Please try again with a more specific query if needed.",
            url: errorUrl,
            citations: [],
          };
        }

        if (error.message.includes("navigation") || error.message.includes("Navigation")) {
          logError("Navigation error detected, attempting recovery...");
          await this.browserManager.performRecovery();
          return {
            answer: "The search operation encountered a navigation issue. This might be due to network connectivity problems. Please try again later.",
            url: errorUrl,
            citations: [],
          };
        }
      }

      // For any other errors, return a user-friendly message
      return {
        answer: `The search operation could not be completed. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again later with a more specific query.`,
        url: errorUrl,
        citations: [],
      };
    } finally {
      clearTimeout(operationTimeout);
    }
  }

  private async executeSearch(page: Page, selector: string, query: string): Promise<void> {
    logInfo(`Executing search for: "${query.substring(0, 50)}${query.length > 50 ? "..." : ""}"`);

    // Clear any existing text
    try {
      await page.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLTextAreaElement;
        if (input) input.value = "";
      }, selector);

      await page.click(selector, { clickCount: 3 });
      await page.keyboard.press("Backspace");
    } catch (clearError) {
      logWarn("Error clearing input field:", {
        error: clearError instanceof Error ? clearError.message : String(clearError),
      });
    }

    // Use safe input method that properly handles multiline text, special characters,
    // and Unicode. This replaces keyboard.type() which fails with newlines (FR-001, FR-002).
    // The sendChatMessage function sets the value directly via DOM manipulation and
    // dispatches React-compatible events (R1, R2 from research.md).
    const ctx = this.browserManager.getPuppeteerContext();
    const result = await sendChatMessage(ctx, query, {
      autoSubmit: true,
      verifyValue: true,
      eventTypes: ["input"],
    });

    if (!result.success) {
      throw new Error(`Failed to submit search query: ${result.error}`);
    }

    logInfo(`Search query submitted successfully (${result.durationMs?.toFixed(0)}ms)`);
  }

  // T011: Updated to return { answer, citations } structure
  private async waitForCompleteAnswer(page: Page): Promise<{ answer: string; citations: string[] }> {
    logInfo("Waiting for search response...");

    // First, wait for any response elements to appear
    const proseSelectors = [".prose", '[class*="prose"]', '[class*="answer"]', '[class*="result"]'];

    let selectorFound = false;
    for (const proseSelector of proseSelectors) {
      try {
        await page.waitForSelector(proseSelector, {
          timeout: CONFIG.SELECTOR_TIMEOUT,
          visible: true,
        });
        logInfo(`Found response with selector: ${proseSelector}`);
        selectorFound = true;
        break;
      } catch (selectorError) {
        logWarn(`Selector ${proseSelector} not found, trying next...`);
      }
    }

    if (!selectorFound) {
      logError("No response selectors found, checking page state...");
      // Check if page is still valid before throwing
      if (!page || page.mainFrame().isDetached()) {
        throw new Error("Page became invalid while waiting for response");
      }
      // Take a screenshot for debugging
      await page.screenshot({ path: "debug_prose_not_found.png", fullPage: true });

      // Check if there's any visible text content that might contain an answer
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText && pageText.length > 200) {
        logInfo("Found text content on page, attempting to extract answer...");
        // Try to extract meaningful content
        return await this.extractFallbackAnswer(page);
      }

      throw new Error("Timed out waiting for response from Perplexity");
    }

    // Now wait for the complete answer using the sophisticated algorithm
    const result = await this.extractCompleteAnswer(page);
    logInfo(`Answer received (${result.answer.length} characters, ${result.citations.length} citations)`);

    return result;
  }

  // T011: Updated to return { answer, citations } structure
  private async extractCompleteAnswer(page: Page): Promise<{ answer: string; citations: string[] }> {
    // Set a timeout to ensure we don't wait indefinitely, but make it much longer
    const timeoutPromise = new Promise<{ answer: string; citations: string[] }>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Waiting for complete answer timed out'));
      }, CONFIG.ANSWER_WAIT_TIMEOUT); // Use the dedicated answer wait timeout
    });

    const answerPromise = page.evaluate(async () => {
      // Security: URL scheme blocklist for preventing code injection attacks
      const BLOCKED_URL_SCHEMES = [
        "java" + "script:", // Prevents eval-like code execution
        "data:", // Prevents data URI attacks
        "vbs" + "cript:", // Prevents VBScript execution
        "#", // Prevents anchor-only URLs
      ];

      const isSafeUrl = (href: string): boolean => {
        if (!href) return false;
        for (const blockedScheme of BLOCKED_URL_SCHEMES) {
          if (href.startsWith(blockedScheme)) {
            return false;
          }
        }
        return true;
      };

      // T011: Return both answer text and citations array separately
      const getAnswerWithCitations = (): { answer: string; citations: string[] } => {
        const elements = Array.from(document.querySelectorAll(".prose"));
        const answerText = elements.map((el) => (el as HTMLElement).innerText.trim()).join("\n\n");

        // Extract all URLs from the answer as citations
        const links = Array.from(document.querySelectorAll(".prose a[href]"));
        const citations = links.map(link => (link as HTMLAnchorElement).href)
          .filter(isSafeUrl)
          .map(href => href.trim())
          .filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates

        return { answer: answerText, citations };
      };

      let lastResult = { answer: '', citations: [] as string[] };
      let lastLength = 0;
      let stabilityCounter = 0;
      let noChangeCounter = 0;
      const maxAttempts = 60; // Restored from backup for better answer quality
      const checkInterval = 600; // Restored from backup

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        const currentResult = getAnswerWithCitations();
        const currentLength = currentResult.answer.length;

        if (currentLength > 0) {
          if (currentLength > lastLength) {
            lastLength = currentLength;
            stabilityCounter = 0;
            noChangeCounter = 0;
          } else if (currentResult.answer === lastResult.answer) {
            stabilityCounter++;
            noChangeCounter++;

            if (currentLength > 1000 && stabilityCounter >= 3) {
              console.log('Long answer stabilized, exiting early');
              break;
            } else if (currentLength > 500 && stabilityCounter >= 4) {
              console.log('Medium answer stabilized, exiting');
              break;
            } else if (stabilityCounter >= 5) {
              console.log('Short answer stabilized, exiting');
              break;
            }
          } else {
            noChangeCounter++;
            stabilityCounter = 0;
          }
          lastResult = currentResult;

          if (noChangeCounter >= 10 && currentLength > 200) {
            console.log('Content stopped growing but has sufficient information');
            break;
          }
        }

        const lastProse = document.querySelector('.prose:last-child');
        const isComplete = lastProse?.textContent?.includes('.') ||
          lastProse?.textContent?.includes('?') ||
          lastProse?.textContent?.includes('!');

        if (isComplete && stabilityCounter >= 2 && currentLength > 100) {
          console.log('Completion indicators found, exiting');
          break;
        }
      }
      return lastResult.answer 
        ? lastResult 
        : { answer: 'No answer content found. The website may be experiencing issues.', citations: [] };
    });

    try {
      // Race between the answer generation and the timeout
      return await Promise.race([answerPromise, timeoutPromise]);
    } catch (error) {
      logError("Error waiting for complete answer:", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Return partial answer if available
      try {
        // Make multiple attempts to get partial content
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const partialAnswer = await page.evaluate(() => {
              const elements = Array.from(document.querySelectorAll('.prose'));
              return elements.map((el) => (el as HTMLElement).innerText.trim()).join('\n\n');
            });

            if (partialAnswer && partialAnswer.length > 50) {
              return { 
                answer: partialAnswer + '\n\n[Note: Answer retrieval was interrupted. This is a partial response.]',
                citations: [],
              };
            }

            // Wait briefly before trying again
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (evalError) {
            logError(`Attempt ${attempt + 1} to get partial answer failed:`, {
              error: evalError instanceof Error ? evalError.message : String(evalError),
            });
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        return { 
          answer: 'Answer retrieval timed out. The service might be experiencing high load. Please try again with a more specific query.',
          citations: [],
        };
      } catch (e) {
        logError("Failed to retrieve partial answer:", {
          error: e instanceof Error ? e.message : String(e),
        });
        return { answer: 'Answer retrieval timed out. Please try again later.', citations: [] };
      }
    }
  }

  // Helper method to extract answer when normal selectors fail
  // T011: Updated to return { answer, citations } structure
  private async extractFallbackAnswer(page: Page): Promise<{ answer: string; citations: string[] }> {
    try {
      const answer = await page.evaluate(() => {
        // Try various ways to find content
        const contentSelectors = [
          // Common content containers
          'main', 'article', '.content', '.answer', '.result',
          // Text containers
          'p', 'div > p', '.text', '[class*="text"]',
          // Any large text block
          'div:not(:empty)'
        ];

        for (const selector of contentSelectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          // Filter to elements with substantial text
          const textElements = elements.filter(el => {
            const text = (el as HTMLElement).innerText.trim();
            return text.length > 100; // Only consider elements with substantial text
          });

          if (textElements.length > 0) {
            // Sort by text length to find the most substantial content
            textElements.sort((a, b) => {
              return (b as HTMLElement).innerText.length - (a as HTMLElement).innerText.length;
            });

            // Get the top 3 elements with the most text
            const topElements = textElements.slice(0, 3);
            return topElements.map(el => (el as HTMLElement).innerText.trim()).join('\n\n');
          }
        }

        // Last resort: get any visible text
        return document.body.innerText.substring(0, 2000) + '\n\n[Note: Content extraction used fallback method due to page structure changes]';
      });
      return { answer, citations: [] };
    } catch (error) {
      logError("Error in fallback answer extraction:", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { answer: 'Unable to extract answer content. The website structure may have changed.', citations: [] };
    }
  }

  private generateErrorResponse(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("timeout") || errorMessage.includes("Timed out")) {
      return "The search operation is taking longer than expected. This might be due to high server load. Please try again with a more specific query.";
    }

    if (errorMessage.includes("navigation") || errorMessage.includes("Navigation")) {
      return "The search operation encountered a navigation issue. This might be due to network connectivity problems. Please try again later.";
    }

    if (errorMessage.includes("detached") || errorMessage.includes("Detached")) {
      return "The search operation encountered a technical issue. Please try again with a more specific query.";
    }

    return `The search operation could not be completed. Error: ${errorMessage}. Please try again later with a more specific query.`;
  }
}
