/*
 * Inngest HTTP endpoint. Inngest's cloud (or local dev server) hits this
 * route to discover and invoke our durable functions.
 */

import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { runGeneration } from "@/inngest/functions/run-generation";
import { generatePrintFiles } from "@/inngest/functions/generate-print-files";
import { sendOrderConfirmation } from "@/inngest/functions/send-order-confirmation";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runGeneration, generatePrintFiles, sendOrderConfirmation],
});
