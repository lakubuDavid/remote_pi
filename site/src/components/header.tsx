import Image from "next/image";
import Link from "next/link";

const GITHUB_URL = "https://github.com/jacobaraujo7/remote_pi";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-soft bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Remote Pi — home">
          <Image
            src="/logo.svg"
            alt=""
            width={32}
            height={32}
            priority
            className="rounded-md"
          />
          <span className="font-semibold tracking-tight text-fg">
            Remote Pi
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link
            href="/docs"
            className="rounded-md px-3 py-1.5 text-muted transition-colors hover:text-fg"
          >
            Docs
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-3 py-1.5 text-muted transition-colors hover:text-fg"
          >
            GitHub
          </a>
          <Link
            href="/#get-the-app"
            className="hidden rounded-md px-3 py-1.5 text-muted transition-colors hover:text-fg sm:inline"
          >
            Get the app
          </Link>
        </nav>
      </div>
    </header>
  );
}
