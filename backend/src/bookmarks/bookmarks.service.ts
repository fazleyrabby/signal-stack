import { Injectable } from '@nestjs/common';
import { db } from '../database/db';
import { bookmarks, signals } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { type Signal } from '../database/schema';

@Injectable()
export class BookmarksService {
  /**
   * Toggle bookmark for a signal - if bookmarked, remove it; if not, add it
   */
  async toggle(signalId: string, sessionId: string): Promise<{ bookmarked: boolean }> {
    // Check if bookmark already exists
    const existing = await db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.signalId, signalId),
          eq(bookmarks.sessionId, sessionId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Remove bookmark
      await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.signalId, signalId),
            eq(bookmarks.sessionId, sessionId)
          )
        );
      return { bookmarked: false };
    } else {
      // Add bookmark
      await db.insert(bookmarks).values({
        signalId,
        sessionId,
      });
      return { bookmarked: true };
    }
  }

  /**
   * Get all bookmarked signal IDs for a session
   */
  async getBySession(sessionId: string): Promise<string[]> {
    const result = await db
      .select({ signalId: bookmarks.signalId })
      .from(bookmarks)
      .where(eq(bookmarks.sessionId, sessionId));

    return result.map(row => row.signalId);
  }

  /**
   * Get full signal data for bookmarked signals with pagination
   */
  async getBookmarkedSignals(sessionId: string, limit: number, offset: number) {
    const { data, total } = await db
      .select({
        id: signals.id,
        source: signals.source,
        title: signals.title,
        content: signals.content,
        summary: signals.summary,
        url: signals.url,
        score: signals.score,
        categoryId: signals.categoryId,
        aiCategory: signals.aiCategory,
        severity: signals.severity,
        hash: signals.hash,
        publishedAt: signals.publishedAt,
        aiSummary: signals.aiSummary,
        aiProvider: signals.aiProvider,
        aiProcessed: signals.aiProcessed,
        aiFailed: signals.aiFailed,
        createdAt: signals.createdAt,
      })
      .from(bookmarks)
      .innerJoin(signals, eq(bookmarks.signalId, signals.id))
      .where(eq(bookmarks.sessionId, sessionId))
      .limit(limit)
      .offset(offset);

    return {
      data,
      meta: {
        limit,
        offset,
        total,
      },
    };
  }
}