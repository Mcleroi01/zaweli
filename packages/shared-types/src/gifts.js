import { z } from "zod";
/** Types de cadeaux connus (table app.gift_types). Extensible. */
export const GIFT_TYPES = ["MONEY", "PHYSICAL", "INVITATION", "VOUCHER", "EXPERIENCE"];
export const giftTypeSchema = z.enum(GIFT_TYPES);
/** Code ISO 4217 en majuscules. */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
//# sourceMappingURL=gifts.js.map