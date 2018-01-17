"use strict"

module.exports = function (acorn) {
  const acornVersion = acorn.version.match(/^5\.(\d+)\./)
  if (!acornVersion || Number(acornVersion[1]) < 3) {
    throw new Error("Unsupported acorn version " + acorn.version + ", please use acorn 5 >= 5.3");
  }

  const tt = acorn.tokTypes

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
    instance.extend("parseProperty", function (superF) {
      return function(isPattern, refDestructuringErrors) {
        if (isPattern || !(this.options.ecmaVersion >= 8 && this.type === tt.name && this.value === "async" && !this.containsEsc)) {
          return superF.call(this, isPattern, refDestructuringErrors)
        }

        let prop = this.startNode(), startPos, startLoc
        prop.method = false
        prop.shorthand = false
        startPos = this.start
        startLoc = this.startLoc
        let isGenerator = false
        let isAsync = false
        this.expectContextual("async")
        if (this.type !== tt.parenL && this.type !== tt.colon && this.type !== tt.comma && this.type !== tt.eq && !this.canInsertSemicolon()) {
          isAsync = true
          isGenerator = this.eat(tt.star)
          this.parsePropertyName(prop, refDestructuringErrors)
        } else {
          prop.computed = false
          prop.key = this.startNodeAt(startPos, startLoc)
          prop.key.name = "async"
          this.finishNode(prop.key, "Identifier")
        }
        this.parsePropertyValue(prop, false, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors)
        return this.finishNode(prop, "Property")
      }
    })

    // Parse async generator functions as class method
    instance.extend("parseClassMember", function (superF) {
      return function(classBody) {
        if (!(this.options.ecmaVersion >= 8 && this.type === tt.name && (this.value === "async" || this.value === "static") && !this.containsEsc)) {
          return superF.call(this, classBody)
        }

        let method = this.startNode()
        const tryContextual = (k, noLineBreak) => {
          const start = this.start, startLoc = this.startLoc
          if (!this.eatContextual(k)) return false
          if (this.type !== tt.parenL && (!noLineBreak || !this.canInsertSemicolon())) return true
          if (method.key) this.unexpected()
          method.computed = false
          method.key = this.startNodeAt(start, startLoc)
          method.key.name = k
          this.finishNode(method.key, "Identifier")
          return false
        }

        method.kind = "method"
        method.static = tryContextual("static")
        let isGenerator = this.eat(tt.star)
        let isAsync = false
        if (!isGenerator) {
          if (this.options.ecmaVersion >= 8 && tryContextual("async", true)) {
            isAsync = true
            isGenerator = this.eat(tt.star)
          } else if (tryContextual("get")) {
            method.kind = "get"
          } else if (tryContextual("set")) {
            method.kind = "set"
          }
        }
        if (!method.key) this.parsePropertyName(method)
        let key = method.key
        if (!method.computed && !method.static && (key.type === "Identifier" && key.name === "constructor" ||
            key.type === "Literal" && key.value === "constructor")) {
          if (method.kind !== "method") this.raise(key.start, "Constructor can't have get/set modifier")
          if (isGenerator) this.raise(key.start, "Constructor can't be a generator")
          if (isAsync) this.raise(key.start, "Constructor can't be an async method")
          method.kind = "constructor"
        } else if (method.static && key.type === "Identifier" && key.name === "prototype") {
          this.raise(key.start, "Classes may not have a static property named prototype")
        }
        this.parseClassMethod(classBody, method, isGenerator, isAsync)
        if (method.kind === "get" && method.value.params.length !== 0) {
          this.raiseRecoverable(method.value.start, "getter should have no params")
        }
        if (method.kind === "set" && method.value.params.length !== 1) {
          this.raiseRecoverable(method.value.start, "setter should have exactly one param")
        }
        if (method.kind === "set" && method.value.params[0].type === "RestElement") {
          this.raiseRecoverable(method.value.params[0].start, "Setter cannot use rest params")
        }
        return method
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
