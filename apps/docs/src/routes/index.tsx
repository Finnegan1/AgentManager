import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          Agent Manager
        </Link>
        <a
          href="https://github.com/Finnegan1/AgentManager"
          target="_blank"
          rel="noopener noreferrer"
          className="landing-nav-link"
        >
          GitHub ↗
        </a>
      </nav>

      <main className="landing-main">
        <h1 className="landing-h1">
          One gateway for all
          <br />
          your AI tools.
        </h1>

        <p className="landing-soon">Available soon</p>

        <div className="landing-img-wrap">
          <img
            src={`${base}screenshot-dark.png`}
            alt="Agent Manager"
            className="landing-img landing-img-dark"
          />
          <img
            src={`${base}screenshot-light.png`}
            alt="Agent Manager"
            className="landing-img landing-img-light"
          />
        </div>
      </main>

      <section className="landing-info">
        <div className="landing-info-block">
          <h2>Unified MCP Gateway</h2>
          <p>
            Connect multiple MCP servers through a single endpoint. Your agents
            see one connection — behind it, every tool they need.
          </p>
        </div>
        <div className="landing-info-block">
          <h2>Native Desktop App</h2>
          <p>
            A Tauri application to manage servers, skills, and configuration.
            Everything in one place, running locally.
          </p>
        </div>
        <div className="landing-info-block">
          <h2>Skills as Markdown</h2>
          <p>
            Define, share, and install AI skills as portable markdown files.
            Browse the marketplace or write your own.
          </p>
        </div>
        <div className="landing-info-block">
          <h2>Hot-Reload Config</h2>
          <p>
            Change settings, add servers, update skills — everything applies
            instantly without restarting.
          </p>
        </div>
      </section>

      <footer className="landing-ft">
        <span>Agent Manager</span>
        <a
          href="https://github.com/Finnegan1/AgentManager"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <Link to="/docs/$" params={{ _splat: '' }}>
          Docs
        </Link>
      </footer>
    </div>
  );
}
