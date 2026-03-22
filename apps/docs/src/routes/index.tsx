import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-col items-center justify-center text-center flex-1">
        <h1 className="font-semibold text-2xl mb-2">Skill Gateway</h1>
        <p className="text-fd-muted-foreground mb-6 max-w-md">
          Manage AI skills and proxy multiple MCP servers through a single unified gateway.
        </p>
        <Link
          to="/docs/$"
          params={{
            _splat: '',
          }}
          className="px-4 py-2 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium text-sm mx-auto"
        >
          Read the Docs
        </Link>
      </div>
    </HomeLayout>
  );
}
