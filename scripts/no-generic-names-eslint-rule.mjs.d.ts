interface NoGenericNamesRuleReport {
  message: string
}

interface NoGenericNamesRuleContext {
  getFilename(): string | undefined
  report(report: NoGenericNamesRuleReport): void
}

interface NoGenericNamesRuleListener {
  Program(node: unknown): void
  ClassDeclaration(node: { id: { name: string } | null }): void
}

interface NoGenericNamesRule {
  meta: {
    type: "problem"
    docs: {
      description: string
      recommended: boolean
    }
  }
  create(context: NoGenericNamesRuleContext): NoGenericNamesRuleListener
}

declare const noGenericNames: NoGenericNamesRule

export default noGenericNames
