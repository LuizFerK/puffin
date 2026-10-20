// @unocss-include: the icon classes below only exist in this .ts file
// Single source for the sidebar and its Ctrl+Shift+<shortcut> bindings
export interface NavItem {
  path: string
  label: string
  icon: string
  shortcut: string
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/connections", label: "Connections", icon: "i-lucide-database", shortcut: "D" },
  // TODO: When enter the console page auto focus on the editor
  { path: "/", label: "Console", icon: "i-lucide-terminal", shortcut: "E" },
  { path: "/backups", label: "Backups", icon: "i-lucide-database-backup", shortcut: "R" },
  { path: "/collection", label: "Collection", icon: "i-lucide-bookmark", shortcut: "C" },
  { path: "/history", label: "History", icon: "i-lucide-history", shortcut: "X" },
]

export const SETTINGS_ITEM: NavItem = {
  path: "/settings",
  label: "Settings",
  icon: "i-lucide-settings",
  shortcut: "S",
}
