import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { Network, Monitor, Sparkles, Zap } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: Home,
});

const features = [
  {
    icon: Network,
    title: 'Unified Gateway',
    description:
      'Proxy multiple MCP servers through a single endpoint. One connection, all your tools.',
  },
  {
    icon: Monitor,
    title: 'Desktop App',
    description:
      'Native Tauri application to manage servers, skills, and configuration visually.',
  },
  {
    icon: Sparkles,
    title: 'Skills Marketplace',
    description:
      'Discover, install, and share AI skills as portable markdown definitions.',
  },
  {
    icon: Zap,
    title: 'Hot-Reload Config',
    description:
      'Instant configuration updates. Change settings without restarting your servers.',
  },
];

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="landing-page">
        {/* Background grid */}
        <div className="landing-grid" />

        {/* Glow orb */}
        <div className="landing-glow" />

        {/* Hero */}
        <section className="landing-hero">
          <p className="landing-badge" style={{ animationDelay: '0ms' }}>
            Open Source MCP Framework
          </p>
          <h1 className="landing-headline" style={{ animationDelay: '80ms' }}>
            The simplest way to
            <br />
            <span className="landing-headline-accent">manage AI skills.</span>
          </h1>
          <p className="landing-sub" style={{ animationDelay: '160ms' }}>
            Skill Gateway unifies multiple MCP servers behind a single endpoint,
            <br className="hidden sm:block" />
            so your agents get every tool they need through one connection.
          </p>
          <div
            className="landing-cta-row"
            style={{ animationDelay: '240ms' }}
          >
            <Link
              to="/docs/$"
              params={{ _splat: '' }}
              className="landing-cta"
            >
              Get Started
              <span className="landing-cta-arrow">→</span>
            </Link>
            <a
              href="https://github.com/Finnegan1/skills-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-cta-secondary"
            >
              GitHub
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="landing-features">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="landing-feature-card"
              style={{ animationDelay: `${320 + i * 80}ms` }}
            >
              <div className="landing-feature-icon">
                <f.icon size={20} strokeWidth={1.5} />
              </div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.description}</p>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="landing-footer" style={{ animationDelay: '700ms' }}>
          <span>Skill Gateway</span>
          <span className="landing-footer-sep">·</span>
          <a
            href="https://github.com/Finnegan1/skills-mcp"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </footer>
      </div>
    </HomeLayout>
  );
}
