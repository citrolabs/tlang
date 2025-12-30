/**
 * Auto-generate node registry from tlang source code
 *
 * This script analyzes tlang's TypeScript source files to extract:
 * - All exported node types
 * - Input/output port definitions
 * - JSDoc descriptions
 * - Type information
 *
 * Single Source of Truth: tlang/src/ is the authoritative source
 *
 * Usage: node scripts/generate-registry.js
 */

import ts from 'typescript'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TLANG_SRC_DIR = join(__dirname, '../../src')
const TLANG_INDEX_PATH = join(TLANG_SRC_DIR, 'index.ts')
const OUTPUT_FILE = join(__dirname, '../src/core/nodes/registry.ts')

// Category colors
const CATEGORY_COLORS = {
  Numbers: '#3b82f6',
  Strings: '#10b981',
  Objects: '#f59e0b',
  Booleans: '#8b5cf6',
  Tuples: '#ec4899',
  Unions: '#ec4899',
  Deep: '#06b6d4',
  Basic: '#f59e0b',
  Conditional: '#6366f1',
  Functions: '#14b8a6',
  Match: '#f97316'
}

/**
 * Parse tlang/src/index.ts to extract all exports
 */
function parseIndexExports() {
  const content = readFileSync(TLANG_INDEX_PATH, 'utf-8')
  const sourceFile = ts.createSourceFile(
    'index.ts',
    content,
    ts.ScriptTarget.Latest,
    true
  )

  const exports = {
    topLevel: new Set(),
    namespaces: new Map()
  }

  // Visit all export declarations
  sourceFile.statements.forEach(statement => {
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const moduleSpecifier = statement.moduleSpecifier.text

      if (statement.exportClause) {
        if (ts.isNamedExports(statement.exportClause)) {
          // export type { A, B, C } from './file'
          statement.exportClause.elements.forEach(element => {
            exports.topLevel.add(element.name.text)
          })
        } else if (ts.isNamespaceExport(statement.exportClause)) {
          // export * as Namespace from './file'
          const namespaceName = statement.exportClause.name.text
          const filePath = join(TLANG_SRC_DIR, moduleSpecifier + '.ts')
          exports.namespaces.set(namespaceName, filePath)
        }
      }
    }
  })

  return exports
}

/**
 * Parse a node source file to extract node definitions
 */
function parseNodeFile(filePath, namespaceName) {
  const content = readFileSync(filePath, 'utf-8')
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  )

  const nodes = []

  // Find all exported type aliases at the end (e.g., export type Add = AddNode)
  const typeExports = new Map()
  sourceFile.statements.forEach(statement => {
    if (ts.isTypeAliasDeclaration(statement) &&
        statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      const name = statement.name.text
      const typeText = statement.type.getText(sourceFile)
      // Check if it's just an alias to a Node interface
      if (typeText.endsWith('Node') || typeText.includes('Node<')) {
        typeExports.set(name, typeText)
      }
    }
  })

  // Find all Node interfaces
  sourceFile.statements.forEach(statement => {
    if (ts.isInterfaceDeclaration(statement)) {
      const interfaceName = statement.name.text

      // Only process interfaces ending with 'Node'
      if (!interfaceName.endsWith('Node')) return

      // Extract JSDoc comment
      const jsDoc = ts.getJSDocCommentsAndTags(statement)
      let description = ''
      if (jsDoc.length > 0) {
        const comment = jsDoc[0].comment
        description = typeof comment === 'string' ? comment :
                     Array.isArray(comment) ? comment.map(c => c.text).join('') : ''
      }

      // Extract inputs and outputs from type members
      let inputs = []
      let outputs = []

      statement.members.forEach(member => {
        if (ts.isPropertySignature(member) && member.name) {
          const memberName = member.name.getText(sourceFile)

          if (memberName === 'inputs' && member.type) {
            inputs = extractPorts(member.type, sourceFile, 'input')
          } else if (memberName === 'outputs' && member.type) {
            outputs = extractPorts(member.type, sourceFile, 'output')
          }
        }
      })

      // Find the export name (e.g., AddNode -> Add)
      let exportName = interfaceName.replace(/Node$/, '')
      for (const [expName, expType] of typeExports.entries()) {
        if (expType === interfaceName || expType.startsWith(interfaceName + '<')) {
          exportName = expName
          break
        }
      }

      nodes.push({
        name: exportName,
        interfaceName,
        description: description.split('\n')[0].trim(),
        inputs,
        outputs
      })
    }
  })

  return nodes
}

/**
 * Extract port definitions from a type node
 */
function extractPorts(typeNode, sourceFile, portType) {
  const ports = []

  if (ts.isTypeLiteralNode(typeNode)) {
    // Simple type literal: { a: number; b: string }
    typeNode.members.forEach(member => {
      if (ts.isPropertySignature(member) && member.name) {
        const portId = member.name.getText(sourceFile)
        const portTypeText = member.type ? member.type.getText(sourceFile) : 'unknown'

        ports.push({
          id: portId,
          label: capitalize(portId),
          type: simplifyType(portTypeText),
          required: portType === 'input' // Inputs are required, outputs are not
        })
      }
    })
  } else if (ts.isConditionalTypeNode(typeNode)) {
    // Conditional type: ... ? { out: Type } : never
    // Extract from the true branch
    const trueType = typeNode.trueType
    return extractPorts(trueType, sourceFile, portType)
  } else {
    // Try to extract from type text for complex types
    const typeText = typeNode.getText(sourceFile)

    // Match patterns like: ? { portName: ... }
    const objectMatch = typeText.match(/\?\s*\{([^}]+)\}/s)
    if (objectMatch) {
      const objectContent = objectMatch[1]
      // Extract property names
      const propertyMatches = objectContent.matchAll(/(\w+)\s*:/g)
      for (const match of propertyMatches) {
        const portId = match[1]
        if (portId && portId !== 'readonly') {
          ports.push({
            id: portId,
            label: capitalize(portId),
            type: 'any',
            required: portType === 'input'
          })
        }
      }
    }
  }

  return ports
}

/**
 * Simplify TypeScript type to basic type
 */
function simplifyType(typeText) {
  if (typeText.includes('number')) return 'number'
  if (typeText.includes('string')) return 'string'
  if (typeText.includes('boolean')) return 'boolean'
  if (typeText.includes('[]') || typeText.includes('Array')) return 'array'
  if (typeText.includes('{') || typeText.includes('Record') || typeText.includes('object')) return 'object'
  return 'any'
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Generate registry file
 */
function generateRegistry() {
  console.log('🔍 Analyzing tlang source code...')

  const exports = parseIndexExports()
  console.log(`✅ Found ${exports.topLevel.size} top-level exports`)
  console.log(`✅ Found ${exports.namespaces.size} namespace exports`)

  const allNodes = []

  // Parse each namespace
  for (const [namespaceName, filePath] of exports.namespaces.entries()) {
    console.log(`📖 Parsing ${namespaceName} from ${filePath}`)
    const nodes = parseNodeFile(filePath, namespaceName)

    nodes.forEach(node => {
      allNodes.push({
        ...node,
        category: namespaceName,
        fullId: `${namespaceName}.${node.name}`,
        tlangType: `${namespaceName}.${node.name}`
      })
    })

    console.log(`   Found ${nodes.length} nodes`)
  }

  // Generate registry code
  const registryEntries = allNodes.map(node => {
    const color = CATEGORY_COLORS[node.category] || '#6b7280'

    return `  '${node.fullId}': {
    id: '${node.fullId}',
    name: '${node.name}',
    category: '${node.category}',
    description: '${node.description || `${node.name} operation`}',
    inputs: [
${node.inputs.map(input => `      { id: '${input.id}', label: '${input.label}', type: '${input.type}', required: ${input.required} }`).join(',\n')}
    ],
    outputs: [
${node.outputs.map(output => `      { id: '${output.id}', label: '${output.label}', type: '${output.type}', required: ${output.required} }`).join(',\n')}
    ],
    tlangType: '${node.tlangType}',
    style: { color: '${color}' }
  }`
  }).join(',\n\n')

  const registryCode = `/**
 * Central registry for all tlang node types
 *
 * AUTO-GENERATED by scripts/generate-registry.js
 * DO NOT EDIT MANUALLY - it will be overwritten
 *
 * Single Source of Truth: tlang/src/
 * Generated at: ${new Date().toISOString()}
 */

import type { TLangNodeMetadata } from '../../types/node'

/**
 * Complete registry of all tlang nodes
 */
export const nodeRegistry: Record<string, TLangNodeMetadata> = {
${registryEntries}
}

/**
 * Get all nodes for a specific category
 */
export function getNodesByCategory(category: string): TLangNodeMetadata[] {
  return Object.values(nodeRegistry).filter(node => node.category === category)
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>()
  Object.values(nodeRegistry).forEach(node => categories.add(node.category))
  return Array.from(categories).sort()
}

/**
 * Get a node by its ID
 */
export function getNodeById(id: string): TLangNodeMetadata | undefined {
  return nodeRegistry[id]
}
`

  writeFileSync(OUTPUT_FILE, registryCode, 'utf-8')
  console.log(`✅ Generated ${OUTPUT_FILE}`)
  console.log(`   Total nodes: ${allNodes.length}`)
}

// Run the generator
try {
  generateRegistry()
} catch (error) {
  console.error('❌ Failed to generate registry:', error)
  process.exit(1)
}
