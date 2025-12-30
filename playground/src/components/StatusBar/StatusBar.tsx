/**
 * Bottom Status Bar - Display statistics
 */

interface StatusBarProps {
  nodeCount: number
  edgeCount: number
  errors: number
}

export function StatusBar({ nodeCount, edgeCount, errors }: StatusBarProps) {
  return (
    <div className="h-6 bg-gray-100 border-t border-gray-300 flex items-center px-4 text-xs text-gray-600">
      <div className="flex items-center gap-4">
        <span>
          <span className="font-semibold">{nodeCount}</span> node{nodeCount !== 1 ? 's' : ''}
        </span>
        <span>·</span>
        <span>
          <span className="font-semibold">{edgeCount}</span> connection{edgeCount !== 1 ? 's' : ''}
        </span>
        {errors > 0 && (
          <>
            <span>·</span>
            <span className="text-red-600">
              <span className="font-semibold">{errors}</span> error{errors !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
