# Pocket Korean project notes

- This is a private personal Android app; all five areas share the same local vocabulary engine.
- Never add romanized Korean vocabulary or romanized pronunciation. Korean sound hints use Hangul; TTS reads normal spelling.
- Keep dictionary forms separate from polite forms. Speech recognition checks recalled wording, not pronunciation quality.
- Preserve local vocabulary/review history and backup-merge compatibility. Never reset storage to recover from parse/write errors.
- Do not replace working native services with simulated results. Browser-only previews may clearly explain unavailable Android features.
- Model downloads must be initiated visibly. No keys or remote backend are needed for existing translation/ink features.
- Keep Google translation attribution beside results and in About.
- Validate changes with the smallest meaningful tests. `npm test` covers recall, status transitions, imports, and curriculum prerequisites. The Android Actions build compiles and lints the native shell.
- Never commit or upload a signing key as repository content. Default debug builds have disposable identities. Stable signing uses protected Actions secrets, if the owner configures them. Remind the owner to export a backup before replacing a disposable-key build.
