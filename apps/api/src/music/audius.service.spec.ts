import { audiusStreamUrl } from "@zaweli/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../config/env.js";
import { AudiusService } from "./audius.service.js";

const env = { AUDIUS_API_URL: "https://api.audius.co/v1" } as Env;

/** Extrait d'une vraie réponse de GET /v1/tracks/search (20/11/2026), réduit aux champs lus. */
const track = (over: Record<string, unknown> = {}) => ({
  id: "OPgMl",
  title: "Birthday",
  duration: 154,
  permalink: "/bennyclavis/happy-birthday",
  is_streamable: true,
  is_stream_gated: false,
  is_unlisted: false,
  is_delete: false,
  stream_conditions: null,
  access: { stream: true, download: true },
  artwork: { "150x150": "https://cn.example/150x150.jpg", "480x480": "https://cn.example/480x480.jpg", mirrors: ["https://m.example"] },
  user: { id: "5QB3Y", name: "Benny Clavis", handle: "bennyclavis" },
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("Recherche Audius", () => {
  it("ne propose que les titres lisibles librement, avec leurs crédits", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            track(),
            track({ id: "gated", is_stream_gated: true, stream_conditions: { usdc_purchase: {} } }),
            track({ id: "hidden", is_unlisted: true }),
            track({ id: "noart", artwork: null, user: { handle: "anon" } }),
          ],
        }),
      ),
    );
    const tracks = await new AudiusService(env).search("anniversaire", 10);
    expect(tracks).toEqual([
      {
        source: "audius",
        trackId: "OPgMl",
        title: "Birthday",
        artist: "Benny Clavis",
        permalink: "/bennyclavis/happy-birthday",
        durationSeconds: 154,
        artworkUrl: "https://cn.example/480x480.jpg",
      },
      expect.objectContaining({ trackId: "noart", artist: "anon", artworkUrl: null }),
    ]);
    const url = fetchMock.mock.calls[0]![0] as URL;
    expect(url.pathname).toBe("/v1/tracks/search");
    expect(url.searchParams.get("query")).toBe("anniversaire");
    expect(url.searchParams.get("api_key")).toBeNull();
  });

  it("signale une indisponibilité plutôt qu'une liste vide trompeuse", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("oops", { status: 502 }));
    await expect(new AudiusService(env).search("x y", 5)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("construit l'adresse de lecture, avec la clé d'application si elle existe", () => {
    expect(audiusStreamUrl("OPgMl")).toBe("https://api.audius.co/v1/tracks/OPgMl/stream");
    expect(audiusStreamUrl("OPgMl", "abc")).toBe("https://api.audius.co/v1/tracks/OPgMl/stream?api_key=abc");
  });
});
