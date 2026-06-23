> **⚠️ Fork notice** — This is a **community fork** of the original
> [remote-pi](https://github.com/jacobaraujo7/remote_pi) project by
> [Jacob Moura](https://github.com/jacobaraujo7). All credit for the
> core architecture, protocol, and mobile apps goes to the original
> author.

---

<p align="center">
  <img src="branding/logo-full.svg" width="140" alt="Remote Pi logo" />
</p>

<h1 align="center">Remote Pi</h1>

<p align="center">
  Control your <a href="https://github.com/earendil-works/pi">Pi coding agent</a> from your phone.
  Pair with a one-time QR code and chat with your local agent — even when you're away from your computer.
</p>

> **Original project** by [Jacob Moura](https://github.com/jacobaraujo7) —
> [github.com/jacobaraujo7/remote_pi](https://github.com/jacobaraujo7/remote_pi)

---

## Links

- **Official site** — <https://remote-pi.jacobmoura.work>
- **Package documentation** — <https://pi.dev/packages/remote-pi?name=remote-pi>
- **Original repository** — <https://github.com/jacobaraujo7/remote_pi>

### Downloads

| Platform | Status |
|---|---|
| Google Play (Android) | [Get it on Google Play](https://play.google.com/store/apps/details?id=work.jacobmoura.remotepi) |
| App Store (iOS) | [Download on the App Store](https://apps.apple.com/app/remote-pi-coding-agent/id6773499691) |
| APK (sideload, Android) | [GitHub Releases](https://github.com/jacobaraujo7/remote_pi/releases) |

## What's in this repo

| Package | Stack | Role |
|---|---|---|
| [`app/`](./app) | Flutter (iOS / Android) | Mobile client |
| [`pi-extension/`](./pi-extension) | Node + TypeScript | Pi extension exposing `/remote-pi` |
| [`relay/`](./relay) | Rust + Tokio | Stateless WebSocket relay |
| [`site/`](./site) | NextJS | Landing page + legal pages |

## Architecture

```
Flutter app ──wss──► Relay (Rust) ◄──wss── Pi extension (Node)
                                                  │
                                           Local Pi process
                                                  │
                                           UDS broker (local mesh)
                                                  │
                                           Other agents on the same machine
```

- **Pairing** via short-lived QR code; peers persisted in Keychain (mobile) and `~/.pi/remote/` (desktop)
- **TLS in transit** on the WebSocket connection

[92 more lines in file. Use offset=86 to continue.]
