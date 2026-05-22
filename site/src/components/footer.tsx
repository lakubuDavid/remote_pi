import Link from "next/link";

const GITHUB_URL = "https://github.com/jacobaraujo7/remote_pi";

export function SiteFooter() {
  return (
    <footer className="border-t border-border-soft bg-bg">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 text-sm text-muted sm:flex-row sm:items-center">
        <p className="leading-relaxed">
          © {new Date().getFullYear()} Flutterando. Remote Pi is open source under the MIT license.
        </p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/terms" className="transition-colors hover:text-fg">
            Terms of Service
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-fg">
            Privacy Policy
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-fg"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
