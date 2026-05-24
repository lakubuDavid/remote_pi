import Image from "next/image";

const GITHUB_URL = "https://github.com/jacobaraujo7/remote_pi";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border-soft">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute left-1/2 top-0 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 text-center sm:py-28">
        <Image
          src="/logo.svg"
          alt="Remote Pi logo"
          width={160}
          height={160}
          priority
          className="rounded-3xl"
        />
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-balance text-5xl font-semibold tracking-tight text-fg sm:text-6xl">
            Remote Pi
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted sm:text-xl">
            Your coding agents talk to each other across every machine you work
            from. Your phone is just the authenticator — scan a QR once and the
            mesh runs by itself. Fully open source.
          </p>
        </div>
        <div className="mt-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <a
            href="#quick-start"
            className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Install on Pi
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border-soft px-6 text-sm font-semibold text-fg transition-colors hover:border-fg/40"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
