import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Overview', end: true },
  { to: '/cards', label: 'Cards' },
  { to: '/statements', label: 'Statements' },
  { to: '/bills', label: 'Bills' },
  { to: '/investments', label: 'Investments' },
]

export function WorkspaceLayout() {
  return (
    <div className="mx-auto box-border max-w-[1200px] px-8 py-6 pb-12">
      <header className="flex flex-wrap items-center gap-8 border-b border-line pb-6">
        <div className="flex items-center gap-2.5 text-lg font-bold">
          <span className="inline-block h-7 w-7 rounded-lg bg-accent" />
          JH Finance
        </div>
        <nav aria-label="Primary" className="flex gap-[22px] text-sm text-muted">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive
                  ? 'border-b-2 border-accent pb-1.5 font-semibold text-ink'
                  : 'text-muted'
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3.5">
          <label className="relative">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
              ⌕
            </span>
            <input
              type="search"
              placeholder="Search transactions, holdings"
              className="w-[260px] rounded-[10px] border border-line bg-white py-2 pr-3 pl-8 font-sans text-sm text-ink"
            />
          </label>
          <div
            aria-label="Account menu"
            className="grid h-[34px] w-[34px] place-items-center rounded-full bg-line text-[13px] font-semibold"
          >
            AM
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
