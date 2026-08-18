/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/music.ts — the MUSIC STUDIO documents: artists (a look + a voice +
 * a style line) and songs (lyrics + steering prompt + band slots + lineage).
 * Generation rides client.media.generate; these are the documents around it.
 */

import type { AuthedHttp } from "../core/authed-http.js";

export interface MusicArtist {
  id: string;
  name: string;
  style: string;
  voiceAssetId: string | null;
  voiceId: string | null;
  avatarAssetId: string | null;
  meta: Record<string, unknown>;
  updatedAt: string;
}

export interface MusicInstrument { instrument: string; tweak: string }

export interface MusicSong {
  id: string;
  title: string;
  lyrics: string;
  prompt: string;
  bandType: string;
  artistIds: string[];
  instruments: MusicInstrument[];
  audioAssetId: string | null;
  parentId: string | null;
  model: string;
  updatedAt: string;
}

export interface MusicArtistInput {
  name: string;
  style?: string;
  voiceAssetId?: string | null;
  voiceId?: string | null;
  avatarAssetId?: string | null;
  meta?: Record<string, unknown>;
}

export interface MusicSongInput {
  title?: string;
  lyrics?: string;
  prompt?: string;
  bandType?: string;
  artistIds?: string[];
  instruments?: MusicInstrument[];
  audioAssetId?: string | null;
  parentId?: string | null;
  model?: string;
}

export class MusicClient {
  constructor(private readonly http: AuthedHttp) {}

  artists(): Promise<MusicArtist[]> {
    return this.http.get<MusicArtist[]>("/api/music/artists");
  }
  createArtist(input: MusicArtistInput): Promise<MusicArtist> {
    return this.http.post<MusicArtist>("/api/music/artists", input);
  }
  updateArtist(id: string, patch: Partial<MusicArtistInput>): Promise<MusicArtist> {
    return this.http.patch<MusicArtist>(`/api/music/artists/${encodeURIComponent(id)}`, patch);
  }
  deleteArtist(id: string): Promise<void> {
    return this.http.del<void>(`/api/music/artists/${encodeURIComponent(id)}`);
  }

  songs(): Promise<MusicSong[]> {
    return this.http.get<MusicSong[]>("/api/music/songs");
  }
  song(id: string): Promise<MusicSong> {
    return this.http.get<MusicSong>(`/api/music/songs/${encodeURIComponent(id)}`);
  }
  createSong(input: MusicSongInput): Promise<MusicSong> {
    return this.http.post<MusicSong>("/api/music/songs", input);
  }
  updateSong(id: string, patch: MusicSongInput): Promise<MusicSong> {
    return this.http.patch<MusicSong>(`/api/music/songs/${encodeURIComponent(id)}`, patch);
  }
  deleteSong(id: string): Promise<void> {
    return this.http.del<void>(`/api/music/songs/${encodeURIComponent(id)}`);
  }
}
