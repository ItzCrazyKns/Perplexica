import db from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/* Sessions do not survive the process, so any row still 'answering'
   at boot belongs to a dead run; without this it spins in the UI
   until someone opens that chat and the reconnect fails. */
const swept = db
  .update(messages)
  .set({ status: 'error' })
  .where(eq(messages.status, 'answering'))
  .run();

if (swept.changes > 0) {
  console.log(
    `Startup sweep: marked ${swept.changes} orphaned answering message(s) as error`,
  );
}
