interface BreadcrumbsProps {
  items: string[]
  onNavigate: (index: number) => void
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-bg-tertiary text-gray-400 hover:text-white transition-colors"
      >
        <span>🏠</span>
        <span>Root</span>
      </button>

      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-gray-600">›</span>
          <button
            onClick={() => onNavigate(i)}
            className={`
              px-2 py-1 rounded transition-colors
              ${i === items.length - 1 
                ? 'text-white font-medium' 
                : 'text-gray-400 hover:text-white hover:bg-bg-tertiary'
              }
            `}
          >
            {getIcon(item)} {getLabel(item)}
          </button>
        </div>
      ))}
    </nav>
  )
}

function getIcon(path: string): string {
  if (path.includes('/')) return '📦'
  return '📄'
}

function getLabel(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}
