import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getAdminUnreadNotificationsCount } from "@/lib/services/admin-notification-service";

export const dynamic = "force-dynamic";

const UNREAD_POLL_INTERVAL_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 25000;

function createSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) {
    return auth.response;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unreadCount = 0;
      let unreadPollTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const push = (message: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(message));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (unreadPollTimer) {
          clearInterval(unreadPollTimer);
          unreadPollTimer = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // Stream already closed.
        }
      };

      request.signal.addEventListener("abort", close);

      try {
        unreadCount = await getAdminUnreadNotificationsCount(auth.session.sub);
      } catch {
        unreadCount = 0;
      }

      push(createSseEvent("unread", { unreadCount, ts: new Date().toISOString() }));

      unreadPollTimer = setInterval(async () => {
        try {
          const nextUnreadCount = await getAdminUnreadNotificationsCount(auth.session.sub);
          if (nextUnreadCount === unreadCount) return;
          unreadCount = nextUnreadCount;
          push(createSseEvent("unread", { unreadCount, ts: new Date().toISOString() }));
        } catch {
          // Keep stream alive and retry on next interval.
        }
      }, UNREAD_POLL_INTERVAL_MS);

      heartbeatTimer = setInterval(() => {
        push(createSseEvent("heartbeat", { ts: new Date().toISOString() }));
      }, HEARTBEAT_INTERVAL_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
