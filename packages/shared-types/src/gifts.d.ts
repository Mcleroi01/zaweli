import { z } from "zod";
/** Types de cadeaux connus (table app.gift_types). Extensible. */
export declare const GIFT_TYPES: readonly ["MONEY", "PHYSICAL", "INVITATION", "VOUCHER", "EXPERIENCE"];
export declare const giftTypeSchema: z.ZodEnum<{
    MONEY: "MONEY";
    PHYSICAL: "PHYSICAL";
    INVITATION: "INVITATION";
    VOUCHER: "VOUCHER";
    EXPERIENCE: "EXPERIENCE";
}>;
export type GiftType = z.infer<typeof giftTypeSchema>;
/** Code ISO 4217 en majuscules. */
export declare const currencySchema: z.ZodString;
//# sourceMappingURL=gifts.d.ts.map