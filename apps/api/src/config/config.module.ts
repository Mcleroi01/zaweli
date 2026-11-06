import { Global, Module } from "@nestjs/common";
import { ENV, loadEnv } from "./env.js";

/** Configuration validée, disponible partout (injection : @Inject(ENV)). */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
