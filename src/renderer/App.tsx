import { useState } from 'react';

// Types for our core features
interface Project {
  id: string;
  name: string;
  path: string;
  type: 'node' | 'python' | 'rust' | 'go' | 'unknown';
}

interface Command {
  id: string;
  name: string;
  command: string;
  description: string;
  tags: string[];
}

interface Container {
  id: string;
  name: string;
  state: 'running' | 'stopped' | 'paused';
}

function App() {
  const [activeTab, setActiveTab] = useState<'projects' | 'commands' | 'containers' | 'history'>('projects');
  const [projects] = useState<Project[]>([]);
  const [commands] = useState<Command[]>([]);
  const [containers] = useState<Container[]>([]);

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <h1>DevDesk</h1>
        </div>
        <nav className="nav">
          <button
            className={activeTab === 'projects' ? 'active' : ''}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
          <button
            className={activeTab === 'commands' ? 'active' : ''}
            onClick={() => setActiveTab('commands')}
          >
            Command Vault
          </button>
          <button
            className={activeTab === 'containers' ? 'active' : ''}
            onClick={() => setActiveTab('containers')}
          >
            Containers
          </button>
          <button
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main">
        {activeTab === 'projects' && (
          <div className="view">
            <header className="view-header">
              <h2>Projects</h2>
              <button className="btn-primary">Add Project</button>
            </header>
            <div className="project-list">
              {projects.length === 0 ? (
                <p className="empty-state">No projects yet. Add your first project!</p>
              ) : (
                projects.map((p) => (
                  <div key={p.id} className="project-card">
                    <h3>{p.name}</h3>
                    <code>{p.path}</code>
                    <span className="badge">{p.type}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'commands' && (
          <div className="view">
            <header className="view-header">
              <h2>Command Vault</h2>
              <button className="btn-primary">Save Command</button>
            </header>
            <div className="command-list">
              {commands.length === 0 ? (
                <p className="empty-state">No saved commands yet.</p>
              ) : (
                commands.map((c) => (
                  <div key={c.id} className="command-card">
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                    <code>{c.command}</code>
                    <div className="tags">
                      {c.tags.map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'containers' && (
          <div className="view">
            <header className="view-header">
              <h2>Containers</h2>
              <button className="btn-secondary">Refresh</button>
            </header>
            <div className="container-list">
              {containers.length === 0 ? (
                <p className="empty-state">No containers found. Docker might not be running.</p>
              ) : (
                containers.map((c) => (
                  <div key={c.id} className="container-card">
                    <h3>{c.name}</h3>
                    <span className={`badge ${c.state}`}>{c.state}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="view">
            <header className="view-header">
              <h2>Run History</h2>
            </header>
            <p className="empty-state">Command history will appear here.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
