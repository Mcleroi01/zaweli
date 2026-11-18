import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  type CreateRecipientRequest,
  createRecipientSchema,
  type RecipientResponse,
  type UpdateRecipientRequest,
  updateRecipientSchema,
} from "@zaweli/shared-types";
import type { Kysely } from "kysely";
import { z } from "zod";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";
import { audit, toIso } from "../database/transaction.js";
import { RequestId } from "../i18n/locale.js";

const idSchema = z.uuid();

/**
 * Fiches destinataires (cahier des charges §6.1, étape 7). Propriété stricte :
 * un utilisateur ne voit et ne touche que les siennes.
 * Une fiche liée à une licence MULTI-USE peut être corrigée (prénom mal
 * orthographié), jamais transformée en une autre personne : chaque
 * correction est journalisée.
 */
@Controller("recipients")
export class RecipientsController {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<RecipientResponse[]> {
    const rows = await this.db
      .selectFrom("app.recipients")
      .selectAll()
      .where("owner_id", "=", user.id)
      .where("deleted_at", "is", null)
      .orderBy("created_at", "desc")
      .execute();
    const bindings = await this.bindings(rows.map((r) => r.id));
    return rows.map((r) => this.toResponse(r, bindings.get(r.id) ?? []));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createRecipientSchema }) body: CreateRecipientRequest,
  ): Promise<RecipientResponse> {
    const row = await this.db
      .insertInto("app.recipients")
      .values({
        owner_id: user.id,
        display_name: body.displayName,
        contact_email: body.contactEmail ?? null,
        contact_phone: body.contactPhone ?? null,
        note: body.note ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toResponse(row, []);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: updateRecipientSchema }) body: UpdateRecipientRequest,
  ): Promise<RecipientResponse> {
    await this.owned(user.id, id);
    const row = await this.db
      .updateTable("app.recipients")
      .set({
        ...(body.displayName !== undefined ? { display_name: body.displayName } : {}),
        ...(body.contactEmail !== undefined ? { contact_email: body.contactEmail } : {}),
        ...(body.contactPhone !== undefined ? { contact_phone: body.contactPhone } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    const bound = (await this.bindings([id])).get(id) ?? [];
    if (bound.length > 0 && body.displayName !== undefined) {
      await audit(this.db, {
        actorType: "user",
        actorId: user.id,
        action: "recipient.bound_renamed",
        entityType: "recipient",
        entityId: id,
        data: { licenseIds: bound },
        requestId,
      });
    }
    return this.toResponse(row, bound);
  }

  /** Suppression logique, refusée si la fiche sert encore (expérience ou licence). */
  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id", { schema: idSchema }) id: string): Promise<void> {
    await this.owned(user.id, id);
    const used = await this.db
      .selectFrom("app.experiences")
      .select("id")
      .where("recipient_id", "=", id)
      .where("status", "<>", "deleted")
      .executeTakeFirst();
    const bound = (await this.bindings([id])).get(id) ?? [];
    if (used || bound.length > 0) throw new ApiException("RECIPIENT_IN_USE");
    await this.db.updateTable("app.recipients").set({ deleted_at: new Date() }).where("id", "=", id).execute();
  }

  private async owned(ownerId: string, id: string) {
    const row = await this.db
      .selectFrom("app.recipients")
      .select("id")
      .where("id", "=", id)
      .where("owner_id", "=", ownerId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!row) throw new ApiException("RECIPIENT_NOT_FOUND");
  }

  private async bindings(ids: string[]) {
    const map = new Map<string, string[]>();
    if (ids.length === 0) return map;
    const rows = await this.db
      .selectFrom("app.license_recipients")
      .select(["recipient_id", "license_id"])
      .where("recipient_id", "in", ids)
      .execute();
    for (const r of rows) map.set(r.recipient_id, [...(map.get(r.recipient_id) ?? []), r.license_id]);
    return map;
  }

  private toResponse(
    r: { id: string; display_name: string; contact_email: string | null; contact_phone: string | null; note: string | null; created_at: Date },
    bound: string[],
  ): RecipientResponse {
    return {
      id: r.id,
      displayName: r.display_name,
      contactEmail: r.contact_email,
      contactPhone: r.contact_phone,
      note: r.note,
      boundLicenseIds: bound,
      createdAt: toIso(r.created_at)!,
    };
  }
}
