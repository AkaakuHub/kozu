# kozu

スマートフォンとPCで曲構成・和音・複数トラックの音符を編集し、Logic Pro向けのMIDIを書き出すWebアプリです。

開発は `vp dev`、検証は `pnpm run check`、デプロイは `cf deploy`。ローカルでクラウド保存を試す場合は、`pnpm run db:migrate:local` でD1を初期化します。本番のマイグレーションは `pnpm run db:migrate:remote`。

[kozu.akaaku.net](https://kozu.akaaku.net/)はCloudflare Accessで保護しています。譜面の差分、ブランチ、PR、ユーザー設定はD1に保存します。

試聴には[FluidR3_GM](https://github.com/gleitz/midi-js-soundfonts/tree/gh-pages/FluidR3_GM)および[808-mini](https://github.com/smpldsnds/drum-machines/tree/main/808-mini)を使用します。
