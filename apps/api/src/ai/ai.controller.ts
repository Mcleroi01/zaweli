import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type AiSuggestRequest, aiSuggestSchema } from "@zaweli/shared-types";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { AiService } from "./ai.service.js";

/** Aide à l'écriture de l'expéditeur (session obligatoire, débit limité). */
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get("quota")
  quota(@CurrentUser() user: AuthenticatedUser) {
    return this.ai.quota(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("suggest")
  @HttpCode(200)
  suggest(@CurrentUser() user: AuthenticatedUser, @Body({ schema: aiSuggestSchema }) body: AiSuggestRequest) {
    return this.ai.suggest(user.id, body);
  }
}
