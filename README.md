# Remote Pi

Remote control para sessões do [Pi coding agent](https://github.com/earendil-works/pi).

Controle sessões Pi locais a partir do celular via QR code, com end-to-end encryption.

## Por quê

O Pi é o concorrente open source mais relevante do Claude Code. Ele já tem
RPC mode, SDK público e sessões persistentes em JSONL — mas falta uma forma
boa de usar do celular. Remote Pi preenche esse gap, no estilo do que a
Anthropic fez com o Claude Code Remote Control oficial, mas para o Pi.

## Arquitetura

```
App Flutter ──wss/E2E──► Relay (Rust) ◄──wss/E2E── Pi extension (Node)
                                                          │
                                                  Pi process local
```

- **Pareamento** via QR code, persiste em Keychain (celular) e `~/.pi/remote/` (Mac)
- **E2E encryption** com Curve25519 + ChaCha20-Poly1305 (libsodium / Noise)
- **Relay nunca lê plaintext** — só roteia ciphertext
- **Forward secrecy**: ECDH efêmero a cada reconexão

## Pacotes

| Pacote | Stack | Função |
|---|---|---|
| [`app/`](./app) | Flutter (iOS/Android) | Cliente mobile |
| [`pi-extension/`](./pi-extension) | Node + TypeScript | Extensão Pi com `/remote-pi` |
| [`relay/`](./relay) | Rust + Tokio | Servidor WebSocket stateless |
| [`site/`](./site) | NextJS | Landing page |

## Status

Em fase de bootstrap. Acompanhe em [`plan/`](./plan).

## Licença

A definir.
