"use strict"

module.exports = function (acorn) {
  const tt = acorn.tokTypes
  const lineBreak = acorn.lineBreak

  acorn.plugins.asyncIteration = function (instance) {

    // Parse for-await-of
    instance.extend("parseForStatement", function (superF) {
      return function (node) {
        this.next()
        node.await = this.eatContextual("await")
        // Hack: Eat next this.next call
        this.next = (function(oldNext) { return function() {this.next = oldNext}})(this.next)
        return superF.call(this, node)
      }
    })

    // Parse async generator functions
    instance.extend("initFunction", function (superF) {
      return function (node) {
        superF.call(this, node)
        if (this.inAsyncGeneratorFunction) node.generator = true
      }
    })

    instance.extend("parseFunction", function (superF) {
      return function(node, isStatement, allowExpressionBody, isAsync) {
        const oldInAsyncGeneratorFunction = this.inAsyncGeneratorFunction
        this.inAsyncGeneratorFunction = isAsync && this.eat(tt.star)
        const _return = superF.call(this, node, isStatement, allowExpressionBody, isAsync)
        this.inAsyncGeneratorFunction = oldInAsyncGeneratorFunction
        return _return
      }
    })

    instance.extend("parseArrowExpression", function (superF) {
      return function(node, params, isAsync) {
        const oldInAsyncGeneratorFunction = this.inAsyncGeneratorFunction
        this.inAsyncGeneratorFunction = false
        const _return = superF.call(this, node, params, isAsync)
        this.inAsyncGeneratorFunction = oldInAsyncGeneratorFunction
        return _return
      }
    })

    instance.extend("parseMethod", function (superF) {
      return function(isGenerator, isAsync) {
        const oldInAsyncGeneratorFunction = this.inAsyncGeneratorFunction
        this.inAsyncGeneratorFunction = isAsync && isGenerator
        const _return = superF.call(this, isGenerator, isAsync)
        this.inAsyncGeneratorFunction = oldInAsyncGeneratorFunction
        return _return
      }
    })

    // Parse async generator functions as object literal method
    instance.extend("isAsyncProp", function (superF) {
      return function(prop) {
        return superF.call(this, prop) || (this.type == tt.star &&
          !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" &&
          !lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))
      }
    })

    instance.extend("parseProperty", function (_superF) {
      return function(isPattern, refDestructuringErrors) {
        // c&p
        let prop = this.startNode(), isGenerator, isAsync, startPos, startLoc
        if (this.options.ecmaVersion >= 6) {
          prop.method = false
          prop.shorthand = false
          if (isPattern || refDestructuringErrors) {
            startPos = this.start
            startLoc = this.startLoc
          }
          if (!isPattern)
            isGenerator = this.eat(tt.star)
        }
        this.parsePropertyName(prop)
        if (!isPattern && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
          isAsync = true
          // Inserted this
          isGenerator = this.eat(tt.star)
          this.parsePropertyName(prop, refDestructuringErrors)
        } else {
          isAsync = false
        }
        this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors)
        return this.finishNode(prop, "Property")
      }
    })

    // Parse async generator functions as class method
    instance.extend("parseClass", function (_superF) {
      return function(node, isStatement) {
        this.next()

        this.parseClassId(node, isStatement)
        this.parseClassSuper(node)
        let classBody = this.startNode()
        let hadConstructor = false
        classBody.body = []
        this.expect(tt.braceL)
        while (!this.eat(tt.braceR)) {
          if (this.eat(tt.semi)) continue
          let method = this.startNode()
          let isGenerator = this.eat(tt.star)
          let isAsync = false
          let isMaybeStatic = this.type === tt.name && this.value === "static"
          this.parsePropertyName(method)
          method.static = isMaybeStatic && this.type !== tt.parenL
          if (method.static) {
            if (isGenerator) this.unexpected()
            isGenerator = this.eat(tt.star)
            this.parsePropertyName(method)
          }
          if (this.options.ecmaVersion >= 8 && !isGenerator && !method.computed &&
              method.key.type === "Identifier" && method.key.name === "async" && this.type !== tt.parenL &&
              !this.canInsertSemicolon()) {
            isAsync = true
            isGenerator = this.eat(tt.star)
            this.parsePropertyName(method)
          }
          method.kind = "method"
          let isGetSet = false
          if (!method.computed) {
            let key = method.key
            if (!isGenerator && !isAsync && key.type === "Identifier" && this.type !== tt.parenL && (key.name === "get" || key.name === "set")) {
              isGetSet = true
              method.kind = key.name
              key = this.parsePropertyName(method)
            }
            if (!method.static && (key.type === "Identifier" && key.name === "constructor" ||
                key.type === "Literal" && key.value === "constructor")) {
              if (hadConstructor) this.raise(key.start, "Duplicate constructor in the same class")
              if (isGetSet) this.raise(key.start, "Constructor can't have get/set modifier")
              if (isGenerator) this.raise(key.start, "Constructor can't be a generator")
              if (isAsync) this.raise(key.start, "Constructor can't be an async method")
              method.kind = "constructor"
              hadConstructor = true
            }
          }
          this.parseClassMethod(classBody, method, isGenerator, isAsync)
          if (isGetSet) {
            let paramCount = method.kind === "get" ? 0 : 1
            if (method.value.params.length !== paramCount) {
              let start = method.value.start
              if (method.kind === "get")
                this.raiseRecoverable(start, "getter should have no params")
              else
                this.raiseRecoverable(start, "setter should have exactly one param")
            } else {
              if (method.kind === "set" && method.value.params[0].type === "RestElement")
                this.raiseRecoverable(method.value.params[0].start, "Setter cannot use rest params")
            }
          }
        }
        node.body = this.finishNode(classBody, "ClassBody")
        return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression")
      }
    })


    // Disallow super() in async generator functions
    instance.extend("parseExprAtom", function (superF) {
      return function(refDestructuringErrors) {
        if (this.type == tt._super && this.inAsyncGeneratorFunction) {
          this.raise(this.start, "'super' in body of async generator")
        }
        return superF.call(this, refDestructuringErrors)
      }
    })

  }
  return acorn
}
