# Component Design Prompt

Work with the user to design the software components for a new feature. Help the user to understand how the new code will look to avoid nasty surprises when reviewing the PR that require a lot of wasted time fixing problems with the design.

Focus on presenting diverse options. The user will choose their preferred option. Don't hesitate to iterate and ask questions rather than making assumptions.

Search all relevant existing code. If some of the code is in other repos, look there as well. Don't be lazy, more too much research is better than not enough. If you're unsure ask the user. As a general rule, if the supporting documenting or existing code references another repository, you should almost certainly be looking there. You can't design new code without understanding how it fits into the bigger picture.

## Pre-flight checklist

1. If the requirements are missing or unclear and you need to make assumptions, stop and discuss the options with the user.
2. If is is not clear where the new code should be placed, or there are multiple viable options, stop and discuss the options with the user.
3. If you have even 1% doubt on anything required to produce the design, stop and discuss the options with the user.

## Task

Generate 3 or more component design options.

Options must be as unique as possible.

Example criteria for identifying unique options:

1. number of components => all of the code in 1 monolithic script vs breakign each fine-grained responsiblity into it's own component
2. size of components
3. touching existing code vs adding new code
4. introducing dependencies
5. coupling vs cohesion
6. DDD vs non-DDD

If two options have the same components with the same responsibilities, they are not unique.

## Component Naming Guidelines

All components must have names that comply with the following guidelines.

### Intention Revealing

A name must describe as clearly and precisely as possible what the the thing is and does.

Good examples:
- `aysnc-file-reader`
- `date-selector`
- `tax-calculator`

Bad examples:
- `data-manager`: what kind of data? how does it manage the data? The name tells us almost nothing here.
- `orders-service`: it does something related to orders but we don't know what? Easy to dump multiple unrelated things into this (like domain logic and external service calls)

### Domain-driven

A name should use established domain terminology wherever possible and should not invent new words and phrases that do not exist in the domain

### Compound noun phrases

Use this pattern as the default: `[Domain Object][Business Action][Role Noun]`.

Example: `InvoicePaymentCollector`

- `Invoice` = domain object
- `Payment` = business object/action target
- `Collector` = role noun / responsibility noun

### Forbidden terms

The following should be avoided at all costs unless truly necessary and reflective of the business domain:

- `util`
- `helper`
- `manager`
- `service`

If you are about to use one of these words, first look for a more precise alternative. "what kind of util?", "what kind of service?"...

## Component Design Guidelines

The following guidelines should be applied when designing components.

### Layering

Components should be put into the correct layer based on the type of logic they contain.

- `domain`: Business rules and domain logic. This should be kept pure and isolated from technical concerns like database transactions. A domain expert should be able to read it and understand it

- `use-case`: The use-case layer is like a menu, it describes the operations the application suppors like `place-order`, `cancel-order` and so on. Each use case is responsible for orchestrating domain logic and technical concerns. The most common pattern is start transaction => load domain object => invoke domain object => save domain object => return results

- `infra`: Technical capabilities live in here like database transactions, persistence, external service clients and so on. Use dedicated sub-folders to properly organize like `/persistence`, `/external-service`

- `/infra/{gateway}`: This sub-layer handles receiving inputs from the outside world and returning responses to the outside world, like gateways sitting at the edge of the application. It's common to see http controllers and event handlers in this layer. Examples of `{gateway}` include `http`, `event-handlers`

Each codebase has it's own layering conventions that should be respected, but when no layering convention exists use the above as the default.

### Component Archetypes

The following are common component archetypes (non-exhaustive, do not be constrained by this list). If a comoponent matches the description of multiple of these, splitting into multiple component each aligned with a single archetype is an alternative option. However, when components are small are handle 1 thing well, it's ok to ecompass multiple archetypes.

1. **entrypoint**: the part of the application that talks to the outside world, like a http controller. A thin layer that parses inputs and hands off to a `use-case` and formats the response
2. **coordinator**: Responsible for orchesstrating multiplpe components  that starts a transaction, loads a database object and invokes an operation on it. A `use-case`: is a good example of a coordinator
3. **stateless calculator**: takes an input, makes a decision, and returns an output.
4. **mapper**: mapps from one format to another
5. **aggregate**: manages the lifecycle of a domain concept protecting invariants. Will only operations to be performed if they permitted in the current state.
6. **value-object**: an abstraction on top a certain piece of data like a `date`. Provides an API with domain terminology for operating on the underlying value. The underlying value cannot be accessed directly.
7. **external service client**: provides methods that represent operations that can be called on a 3rd party service over the network
8. **validator**: accepts as input some data and indicates a result indicating whether the data is valid according to specify rules, like an email validator
9. **factory**: responsible for the construction of an object.
10. **repository**: persists and loads objects, typically to and from a database. In domain-driven design a repository is responsible for saving and loading entire aggregates only and should never be used for partial or ad-hoc loading.
11. **query service**: used to fetch information about an application, typically by querying a database. In domain-driven design, query services are used for read operations and repositories are used for write operations (although repositories can be used for read operations as well)

### General guidelines

1. **Maximum file size is 400 lines**, enforced by lint rules. A component must be decomposed into multiple smaller components when it reaches this limit

## Output Format

# Design Options: [Feature Name]

## Option 1: [Name]

Describe this option by outlining the philosophy behind it and it's key characteristics.

### Diagram

Rules:
- Mark every node `[existing]`, `[new]`, or `[changed]`.
- Show actual dependencies and calls, not a fake straight-line sequence.
- A line means the source component directly calls or depends on the target component.
- Do not connect two components if they do not directly call each other.
- Use branches when one component calls multiple dependencies.
- Label every line with the request, method call, response, event, or query.
- Keep it small.

```text
Client
  |
  | request / methodCall()
  v
[changed] ExistingEntryPoint
  |
  | methodCall()
  v
[new] NewComponent
  |\
  | \ callDependencyA()
  |  v
  | [existing] ExistingDependencyA
  |
  | callDependencyB()
  v
[new] NewDependencyB
```

### Components

| Component | Status | Role Archetypes | Responsibilities | Estimated Size |
|---|---|---|---|---|
| `ComponentName` | New / Existing / Changed | `entrypoint`, `coordinator`, `custom:bulk-copy-script` | <ul><li>Responsibility one</li><li>Responsibility two</li></ul> | Small / Medium / Large, or estimated lines |

**note:**comopnent names must adhere to the component naming guidelines defined in this document

**note:** role archetypes must use names from the Component Archetypes section when applicable. If a component does not match one of the listed archetypes, use a custom archetype prefixed with `custom:`. Example: `custom:bulk-copy-script`.

### New Dependencies

| Dependency | Status | Used By | Purpose |
|---|---|---|---|
| `DependencyName` | New / Existing / Changed | `ComponentName` | One sentence |

### Code Shape

List the main new or changed files only.

```text
src/
  api/
    ExistingEntryPoint.ts        [changed]
  feature/
    NewComponent.ts              [new]
```

### Why This Option Is Unique

Explain the uniqueness using only these criteria:

- number of components
- size of components
- touching existing code vs adding new code
- introducing dependencies

## Option 2: [Name]

Use the same format as Option 1.

## Option 3: [Name]

Use the same format as Option 1.

## Recommendation

Recommend one option in 1 short paragraph.

## Approval

Before presenting the final design, review every component name against all rules in Component Naming Guidelines.

If any name violates any naming rule, revise the design before presenting it.

Ask the user which option to approve, reject, or combine.
