/**
 * Node Properties Panel - Right sidebar for editing selected node
 */

import { X, Link } from 'lucide-react'
import type { GraphNode, GraphEdge } from '../../types/graph'

interface NodePropertiesPanelProps {
  node: GraphNode | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  onClose: () => void
  onUpdate: (nodeId: string, updates: Partial<GraphNode['data']>) => void
}

export function NodePropertiesPanel({ node, nodes, edges, onClose, onUpdate }: NodePropertiesPanelProps) {
  if (!node) {
    return null
  }

  // Find which inputs are connected
  const connectedInputs = new Map<string, { sourceNode: GraphNode; sourceHandle: string }>()
  edges.forEach(edge => {
    if (edge.target === node.id && edge.targetHandle) {
      const sourceNode = nodes.find(n => n.id === edge.source)
      if (sourceNode) {
        connectedInputs.set(edge.targetHandle, {
          sourceNode,
          sourceHandle: edge.sourceHandle ?? 'out'
        })
      }
    }
  })

  const handleInputChange = (inputId: string, value: unknown) => {
    onUpdate(node.id, {
      inputs: {
        ...node.data.inputs,
        [inputId]: value
      }
    })
  }

  return (
    <div className="w-80 bg-white border-l border-gray-300 flex flex-col">
      {/* Header */}
      <div className="h-12 bg-gray-100 border-b border-gray-300 flex items-center justify-between px-4">
        <h3 className="font-semibold text-gray-800">Node Properties</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Node Info */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Node Type
          </label>
          <div className="mt-1 text-sm text-gray-900 font-mono">
            {node.data.metadata.id}
          </div>
        </div>

        {/* Node Description */}
        {node.data.metadata.description && (
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Description
            </label>
            <div className="mt-1 text-sm text-gray-700">
              {node.data.metadata.description}
            </div>
          </div>
        )}

        {/* Type Signature */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Type Signature
          </label>
          <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200">
            <code className="text-xs text-gray-800">
              {node.data.metadata.tlangType}
            </code>
          </div>
        </div>

        {/* Input Values */}
        {node.data.metadata.inputs.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
              Input Values
            </label>
            <div className="space-y-3">
              {node.data.metadata.inputs.map(input => {
                const connection = connectedInputs.get(input.id)

                if (connection) {
                  // Input is connected - show read-only info
                  const outputPort = connection.sourceNode.data.metadata.outputs.find(
                    o => o.id === connection.sourceHandle
                  )
                  return (
                    <div key={input.id} className="bg-blue-50 border border-blue-200 rounded p-2">
                      <label className="text-xs text-gray-700 font-medium flex items-center gap-1">
                        <Link className="w-3 h-3 text-blue-600" />
                        {input.label}
                      </label>
                      <div className="mt-1 text-xs text-blue-700 font-mono">
                        ← {connection.sourceNode.data.label}
                        {outputPort && ` (${outputPort.label})`}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        Type: {input.type}
                      </div>
                    </div>
                  )
                }

                // Input is not connected - show editable field
                return (
                  <div key={input.id}>
                    <label className="text-xs text-gray-700 font-medium">
                      {input.label}
                      {input.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={String(node.data.inputs?.[input.id] ?? '')}
                      onChange={(e) => {
                        // Try to parse as JSON for objects/arrays
                        let value: unknown = e.target.value
                        try {
                          value = JSON.parse(e.target.value)
                        } catch {
                          // Keep as string if not valid JSON
                          value = e.target.value
                        }
                        handleInputChange(input.id, value)
                      }}
                      placeholder={`Enter ${input.type}`}
                      className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    />
                    <div className="mt-0.5 text-xs text-gray-500">
                      Type: {input.type}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Outputs */}
        {node.data.metadata.outputs.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
              Outputs
            </label>
            <div className="space-y-2">
              {node.data.metadata.outputs.map(output => (
                <div key={output.id} className="text-sm">
                  <span className="font-medium text-gray-700">{output.label}</span>
                  <span className="text-gray-500 ml-2">({output.type})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
