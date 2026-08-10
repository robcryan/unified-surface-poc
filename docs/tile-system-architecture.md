# Modular tile system architecture

## Goal

Create a surface that feels like a flexible dashboard, but is structurally decoupled from the underlying application modules. The interface should be able to host user-added tiles, each of which can later be described to an AI so it can generate a different view or workflow without hard-coding knowledge into the UI.

## Core principles

1. Separate presentation from capabilities
   - The tile canvas should manage layout, placement, and interaction.
   - The application modules should expose capabilities, not directly control UI structure.

2. Treat tiles as plug-ins
   - Each tile is a self-contained definition with metadata, rendering logic, and optional capabilities.
   - New tiles can be added by registering them in a catalog rather than editing the page layout directly.

3. Keep the runtime contract simple
   - Tiles should expose a minimal interface such as:
     - id
     - title
     - description
     - default size
     - renderer
     - data source / capability binding

4. Make the system extensible for future AI use
   - Every tile should have a machine-readable description that an AI can understand.
   - The UI should be able to present a tile description, expected inputs, and output intent without needing bespoke logic for each tile.

## Recommended architecture

### 1. Tile registry

Create a central registry that knows which tiles exist and how to instantiate them.

```ts
export type TileManifest = {
  id: string
  title: string
  description: string
  source: string
  defaultSpan: number
  capabilityId?: string
  create: () => TileInstance
}

export type TileInstance = {
  id: string
  title: string
  description: string
  render: () => ReactNode
}
```

This registry becomes the single entry point for discovering available tiles.

### 2. Capability layer

Move domain-specific logic into a separate capability layer.

Example:

- learner signals capability
- section performance capability
- support plan capability

The tile should not know how the whole application is wired. It should ask for a capability or data provider.

```ts
export type CapabilityContext = {
  userContext: unknown
  dataStore: unknown
  aiAdapter?: unknown
}
```

### 3. Layout model

Keep layout state separate from tile definitions.

Recommended layout structure:

```ts
export type LayoutTile = {
  id: string
  span: number
  locked: boolean
  title: string
  manifestId: string
}
```

The canvas should only manage layout state and arrangement. It should not need to know the internals of each tile implementation.

### 4. Renderer abstraction

The canvas should render tiles through a shared contract rather than directly embedding widget-specific components.

```ts
export function renderTile(manifest: TileManifest, context: CapabilityContext) {
  return manifest.create()
}
```

This allows the UI to stay generic while the tile implementation stays domain-specific.

## How to make it AI-friendly

### 1. Add rich metadata

Every tile should include:

- name
- description
- input expectations
- output purpose
- suggested view modes
- constraints

Example:

```ts
export type TileMetadata = {
  id: string
  title: string
  summary: string
  intent: string
  inputs: string[]
  output: string
  preferredSpan: number
}
```

### 2. Provide a promptable description contract

When the user asks an AI to create a different view, the system should be able to send the tile metadata to the model.

Example prompt structure:

- available tiles
- current layout
- user goal
- constraints
- desired output format

### 3. Keep tile definitions declarative

Avoid embedding business rules directly in the canvas. Instead, keep tile definitions declarative and composable.

This makes it possible for an AI to reason over tile types and propose new combinations without touching frontend code.

## Suggested implementation plan

### Phase 1: Introduce the registry

- Define a tile manifest type
- Register a small set of existing tiles
- Replace hard-coded tile rendering with manifest-based rendering

### Phase 2: Extract capabilities

- Move data access into capability modules
- Let tiles request capabilities by id
- Keep the UI unaware of the domain details

### Phase 3: Add layout persistence

- Persist the tile list, span, and placement
- Store metadata separately from the rendered content

### Phase 4: Add AI-facing schema

- Add a metadata schema for each tile
- Support natural-language tile creation requests
- Let the AI propose a new tile configuration or layout

## Recommended boundaries

### UI layer

Responsible for:

- canvas interaction
- layout management
- drag/drop
- resizing
- tile selection and placement

### Tile layer

Responsible for:

- rendering tile contents
- using capabilities for data
- providing metadata and description

### Capability layer

Responsible for:

- fetching data
- enforcing permissions
- formatting results for the UI

## Avoid this anti-pattern

Do not couple the canvas directly to concrete application modules such as:

- learner page components
- section page components
- staff widgets

Instead, make the canvas consume abstractions and let those abstractions resolve to the right implementation.

## Practical recommendation

If the goal is future flexibility, the best shape is:

- a generic dashboard shell
- a tile manifest registry
- a capability interface
- a metadata model for AI interpretation

That keeps the UI mostly detached from the application while still allowing new tiles to be added later in a controlled way.

## Example future workflow

1. User says: “Create a tile that shows recent support activity for this learner.”
2. The app looks up available capabilities and tile templates.
3. An AI proposes a tile manifest and metadata.
4. The system registers the tile in the catalog.
5. The user can place it on the canvas and describe how it should behave.

This model keeps the front-end adaptable while the underlying modules remain reusable and independent.
