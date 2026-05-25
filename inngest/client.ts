/*
 * Inngest client.
 *
 * The single Inngest instance the app uses to send events. Functions are
 * defined in inngest/functions/* and registered in app/api/inngest/route.ts.
 *
 * The event registry below is the contract between the server (which
 * `inngest.send` events) and the functions (which consume them). When you add
 * a new event, add it here too — Inngest derives the TS types from this map.
 */

import { EventSchemas, Inngest } from "inngest";
import type {
  aiGenerationRequestedEventSchema,
  orderPaidEventSchema,
  printFilesNeededEventSchema,
} from "@/lib/parse";
import type { z } from "zod";

type Events = {
  "ai.generation.requested": {
    data: z.infer<typeof aiGenerationRequestedEventSchema>;
  };
  "ai.generation.completed": {
    data: { generationId: string };
  };
  "ai.generation.failed": {
    data: { generationId: string; error: string };
  };
  "order.paid": {
    data: z.infer<typeof orderPaidEventSchema>;
  };
  "order.print_files_needed": {
    data: z.infer<typeof printFilesNeededEventSchema>;
  };
  "order.print_files_ready": {
    data: { orderId: string; orderItemId: string };
  };
};

export const inngest = new Inngest({
  id: "salishforge",
  schemas: new EventSchemas().fromRecord<Events>(),
});
