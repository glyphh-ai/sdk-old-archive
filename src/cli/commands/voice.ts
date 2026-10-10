/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/voice.ts — speech in and out: transcribe a local recording, or
 * synthesize text to an audio file. Keys stay server-side.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";

const AUDIO_MIMES: Record<string, string> = {
  ".webm": "audio/webm", ".mp4": "audio/mp4", ".m4a": "audio/mp4", ".mp3": "audio/mpeg",
  ".wav": "audio/wav", ".ogg": "audio/ogg", ".flac": "audio/flac",
};

export function registerVoice(reg: CommandRegistry): void {
  reg.register({
    path: "voice transcribe",
    summary: "transcribe a recording to text (metered per minute)",
    usage: "voice transcribe <file> --model <sttModel> [--type <mime>] [--ms <length>]",
    covers: ["voice.transcribe"],
    async run(ctx, args) {
      const file = args.positional[0];
      const model = flagStr(args, "model");
      if (!file || !model) throw new Error("usage: voice transcribe <file> --model <sttModel> [--type <mime>] [--ms <length>]");
      const type = flagStr(args, "type") ?? AUDIO_MIMES[extname(file).toLowerCase()];
      if (!type) throw new Error(`unknown audio type "${extname(file)}"; pass --type <mime>`);
      const ms = flagStr(args, "ms");
      const { text } = await ctx.client.voice.transcribe(new Uint8Array(readFileSync(file)), model, type, ms ? Number(ms) : undefined);
      ctx.print(text);
    },
  });

  reg.register({
    path: "voice synthesize",
    summary: "speak text with a TTS model; writes the audio (mp3) to --out",
    usage: "voice synthesize <text…> --model <ttsModel> --out <file.mp3> [--voice <voiceId>]",
    covers: ["voice.synthesize"],
    async run(ctx, args) {
      const text = args.positional.join(" ").trim();
      const model = flagStr(args, "model");
      const out = flagStr(args, "out");
      if (!text || !model || !out) throw new Error("usage: voice synthesize <text…> --model <ttsModel> --out <file.mp3> [--voice <voiceId>]");
      const audio = await ctx.client.voice.synthesize(text, model, flagStr(args, "voice") ?? null);
      writeFileSync(out, new Uint8Array(audio));
      ctx.print(`wrote ${audio.byteLength} bytes → ${out}`);
    },
  });
}
