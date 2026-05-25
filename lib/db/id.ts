import { createId } from "@paralleldrive/cuid2";

/** Project-wide id generator. Use everywhere a new row is created. */
export const newId = createId;
