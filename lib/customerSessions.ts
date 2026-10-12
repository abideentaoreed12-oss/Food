import { randomUUID } from 'node:crypto';
import { d1 } from './d1';

const SESSION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS customer_sessions (
  user_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export async function issueCustomerSession(userId: string): Promise<string> {
  const created = await d1.query(SESSION_TABLE_SQL, [], { cache: false });
  if (!created || created.success === false) {
    throw new Error('Customer session storage is unavailable.');
  }

  const sessionId = randomUUID();
  const saved = await d1.query(
    `INSERT INTO customer_sessions (user_id, session_id, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       session_id = excluded.session_id,
       updated_at = excluded.updated_at`,
    [userId, sessionId, new Date().toISOString()],
    { cache: false }
  );
  if (!saved || saved.success === false) {
    throw new Error('Could not activate customer session.');
  }
  return sessionId;
}

/**
 * Legacy customer JWTs without a session id remain valid only until the account
 * receives its first managed session. Once a session row exists, only its exact
 * session id is accepted. Managed sessions fail closed if D1 cannot be checked.
 */
export async function isCurrentCustomerSession(userId: string, sessionId?: string): Promise<boolean> {
  try {
    const result = await d1.query(
      'SELECT session_id FROM customer_sessions WHERE user_id = ? LIMIT 1',
      [userId],
      { cache: false }
    );
    const current = result.results?.[0] as { session_id?: string } | undefined;
    if (!current) return !sessionId;
    return Boolean(sessionId && current.session_id === sessionId);
  } catch {
    return !sessionId;
  }
}

export async function revokeCustomerSession(userId: string, sessionId: string): Promise<void> {
  await d1.query(
    'DELETE FROM customer_sessions WHERE user_id = ? AND session_id = ?',
    [userId, sessionId],
    { cache: false }
  );
}
