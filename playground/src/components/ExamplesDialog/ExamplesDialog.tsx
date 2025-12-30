/**
 * Examples Dialog - Modal for selecting example projects
 */

import { exampleProjects } from '../../data/examples'
import type { Project } from '../../types/project'

interface ExamplesDialogProps {
  onLoadExample: (project: Project) => void
  onClose: () => void
}

export function ExamplesDialog({ onLoadExample, onClose }: ExamplesDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="h-12 bg-gray-100 border-b border-gray-300 flex items-center justify-between px-4">
          <h2 className="font-semibold text-gray-800">Load Example</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-3">
            {exampleProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => onLoadExample(project)}
                className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all"
              >
                <div className="font-semibold text-gray-900 mb-1">
                  {project.name}
                </div>
                <div className="text-sm text-gray-600">
                  {project.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
