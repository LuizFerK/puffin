import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Settings, User, Palette, ChevronLeft, ChevronRight } from 'lucide-react'

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isThemeOpen, setIsThemeOpen] = useState(false)

  return (
    <aside
      h-full flex="~ col"
      border-r="1px solid [var(--btn-bg)]"
      bg="[var(--btn-bg)]/50"
      backdrop-blur-md
      transition-all duration-300
      className={isCollapsed ? 'w-20' : 'w-64'}
    >
      {/* Logo */}
      <div p-6 flex justify-center items-center>
        <img src="/tauri.svg" h-12 alt="Logo" />
      </div>

      {/* Navigation */}
      <nav flex="~ col" flex-1 gap-2 p-4 justify-center>
        <NavLink
          to="/"
          className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-[var(--text)] no-underline ${isActive ? 'bg-[var(--btn-hover)] font-bold' : 'hover:bg-[var(--btn-hover)]'} ${isCollapsed ? 'justify-center' : ''}`}
        >
          <Home size={20} />
          {!isCollapsed && <span>Page 1</span>}
        </NavLink>
        <NavLink
          to="/page2"
          className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-[var(--text)] no-underline ${isActive ? 'bg-[var(--btn-hover)] font-bold' : 'hover:bg-[var(--btn-hover)]'} ${isCollapsed ? 'justify-center' : ''}`}
        >
          <User size={20} />
          {!isCollapsed && <span>Page 2</span>}
        </NavLink>
        <NavLink
          to="/page3"
          className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-[var(--text)] no-underline ${isActive ? 'bg-[var(--btn-hover)] font-bold' : 'hover:bg-[var(--btn-hover)]'} ${isCollapsed ? 'justify-center' : ''}`}
        >
          <Settings size={20} />
          {!isCollapsed && <span>Page 3</span>}
        </NavLink>
      </nav>

      {/* Theme Switcher */}
      <div p-4 border-t="1px solid [var(--btn-bg)]">
        <div relative>
          <button
            w-full flex items-center gap-3 px-4 py-3 rounded-lg bg="[var(--btn-bg)]" text="[var(--text)]" border-none cursor-pointer hover:bg="[var(--btn-hover)]"
            className={isCollapsed ? 'justify-center' : ''}
            onClick={() => setIsThemeOpen(!isThemeOpen)}
          >
            <Palette size={20} />
            {!isCollapsed && <span>Theme</span>}
          </button>

          {/* Dropdown Content */}
          <div className={isThemeOpen ? 'block' : 'hidden'} absolute bottom-full left-0 w-full mb-2 bg="[var(--btn-bg)]" rounded-lg shadow-lg backdrop-blur-md z-10>
            <label htmlFor="theme-light" block px-4 py-3 cursor-pointer hover:bg="[var(--btn-hover)]" onClick={() => setIsThemeOpen(false)}>
              {isCollapsed ? 'L' : 'Light'}
            </label>
            <label htmlFor="theme-dark" block px-4 py-3 cursor-pointer hover:bg="[var(--btn-hover)]" onClick={() => setIsThemeOpen(false)}>
              {isCollapsed ? 'D' : 'Dark'}
            </label>
            <label htmlFor="theme-transparent" block px-4 py-3 cursor-pointer hover:bg="[var(--btn-hover)]" onClick={() => setIsThemeOpen(false)}>
              {isCollapsed ? 'T' : 'Transparent'}
            </label>
          </div>
        </div>
      </div>

      {/* Collapse Toggle */}
      <div p-4 border-t="1px solid [var(--btn-bg)]" flex justify-center>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          p-2 rounded-lg bg="transparent" text="[var(--text)]" border-none cursor-pointer hover:bg="[var(--btn-hover)]"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </aside>
  )
}
