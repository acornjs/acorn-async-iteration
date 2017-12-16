"use strict"

const assert = require("assert")
const acorn = require("..")

function test(text, expectedResult, additionalOptions) {
  it(text, function () {
    const result = acorn.parse(text, Object.assign({ ecmaVersion: 9, plugins: { asyncIteration: true } }, additionalOptions))
    if (expectedResult) {
      assert.deepEqual(result.body[0], expectedResult)
    }
  })
}
function testFail(text, expectedResult, additionalOptions) {
  it(text, function () {
    let failed = false
    try {
      acorn.parse(text, Object.assign({ ecmaVersion: 9, plugins: { asyncIteration: true } }, additionalOptions))
    } catch (e) {
      failed = true
    }
    assert(failed)
  })
}

describe("acorn-async-iteration", function () {
  test(
    "for await (const line of readLines(filePath)) {\n" +
    "  console.log(line);\n" +
    "}", {
      type: "ForOfStatement",
      start: 0,
      end: 70,
      await: true,
      left: {
        type: "VariableDeclaration",
        start: 11,
        end: 21,
        declarations: [ {
          type: "VariableDeclarator",
          start: 17,
          end: 21,
          id: { type: "Identifier", start: 17, end: 21, name: "line" },
          init: null } ],
        kind: "const" },
      right: {
        type: "CallExpression",
        start: 25,
        end: 44,
        callee: { type: "Identifier", start: 25, end: 34, name: "readLines" },
        arguments: [ { type: "Identifier", start: 35, end: 43, name: "filePath" } ]
      },
      body: {
        type: "BlockStatement",
        start: 46,
        end: 70,
        body: [ {
          type: "ExpressionStatement",
          start: 50,
          end: 68,
          expression: {
            type: "CallExpression",
            start: 50,
            end: 67,
            callee: {
              type: "MemberExpression",
              start: 50,
              end: 61,
              object: { type: "Identifier", start: 50, end: 57, name: "console" },
              property: { type: "Identifier", start: 58, end: 61, name: "log" },
              computed: false },
            arguments: [ { type: "Identifier", start: 62, end: 66, name: "line" } ]
          }
        } ]
      }
    }
  )

  const functions = [
    { text: "async function* x() %s" },

    { text: "ref = async function*() %s" },

    { text: "(async function*() %s)" },

    { text: "var gen = { async *method() %s }", ast: body => {
      body = body(28)
      return {
        type: "VariableDeclaration",
        start: 0,
        end: body.end + 2,
        declarations: [ {
          type: "VariableDeclarator",
          start: 4,
          end: body.end + 2,
          id: { type: "Identifier", start: 4, end: 7, name: "gen" },
          init: {
            type: "ObjectExpression",
            start: 10,
            end: body.end + 2,
            properties: [ {
              type: "Property",
              start: 12,
              end: body.end,
              method: true,
              shorthand: false,
              computed: false,
              key: { type: "Identifier", start: 19, end: 25, name: "method" },
              kind: "init",
              value: {
                type: "FunctionExpression",
                start: 25,
                end: body.end,
                id: null,
                generator: true,
                expression: false,
                async: true,
                params: [],
                body: body
              }
            } ]
          }
        } ],
        kind: "var"
      }
    }},

    {
      text: "export default async function*() %s",
      options: { sourceType: "module" },
      ast: body => {
        body = body(33)
        return {
          type: "ExportDefaultDeclaration",
          start: 0,
          end: body.end,
          declaration: {
            type: "FunctionDeclaration",
            start: 15,
            end: body.end,
            id: null,
            generator: true,
            expression: false,
            async: true,
            params: [],
            body: body
          }
        }
      }
    },

    {
      text: "var C = class { async *method() %s }",
    },

    {
      text: "var C = class { static async *method() %s }",
    }
  ];

  [
    { body: "{}", passes: true, ast: start => ({
      body: [],
      end: start + 2,
      start: start,
      type: "BlockStatement"
    }) },

    { body: "{ super(); }", passes: false, ast: start => ({
      body: [ {
        type: "ExpressionStatement",
        start: start + 2,
        end: start + 9,
        expression: {
          type: "CallExpression",
          start: start + 2,
          end: start + 8,
          callee: { type: "Super", start: start + 2, end: start + 6 },
          arguments: [] } }
      ],
      end: start + 2,
      start: start,
      type: "BlockStatement"
    }) },

    { body: "{ var x = () => { super(); } }", passes: true, ast: start => ({
      end: start + 30,
      start: start,
      type: "BlockStatement",
      body: [ {
        type: "VariableDeclaration",
        start: start + 2,
        end: start + 28,
        kind: "var",
        declarations: [ {
          type: "VariableDeclarator",
          start: start + 6,
          end: start + 28,
          id: { type: "Identifier", start: start + 6, end: start + 7, name: "x" },
          init: {
            type: "ArrowFunctionExpression",
            start: start + 10,
            end: start + 28,
            id: null,
            generator: false,
            expression: false,
            async: false,
            params: [],
            body: {
              type: "BlockStatement",
              start: start + 16,
              end: start + 28,
              body: [ {
                type: "ExpressionStatement",
                start: start + 18,
                end: start + 26,
                expression: {
                  type: "CallExpression",
                  start: start + 18,
                  end: start + 25,
                  callee: { type: "Super", start: start + 18, end: start + 23 },
                  arguments: [] } } ] } }
        } ]
      } ]
    }) },

    { body: "{ var x = function () { super(); } }", passes: true, ast: start => ({
      end: start + 36,
      start: start,
      type: "BlockStatement",
      body: [ {
        type: "VariableDeclaration",
        start: start + 2,
        end: start + 34,
        kind: "var",
        declarations: [ {
          type: "VariableDeclarator",
          start: start + 6,
          end: start + 34,
          id: { type: "Identifier", start: start + 6, end: start + 7, name: "x" },
          init: {
            type: "FunctionExpression",
            start: start + 10,
            end: start + 34,
            id: null,
            generator: false,
            expression: false,
            async: false,
            params: [],
            body: {
              type: "BlockStatement",
              start: start + 22,
              end: start + 34,
              body: [ {
                type: "ExpressionStatement",
                start: start + 24,
                end: start + 32,
                expression: {
                  type: "CallExpression",
                  start: start + 24,
                  end: start + 31,
                  callee: { type: "Super", start: start + 24, end: start + 29 },
                  arguments: [] } } ] } }
        } ]
      } ]
    }) },

    { body: "{ var x = { y: function () { super(); } } }", passes: true, ast: start => ({
      type: "BlockStatement",
      start: start,
      end: start + 43,
      body: [ {
        type: "VariableDeclaration",
        start: start + 2,
        end: start + 41,
        declarations: [ {
          type: "VariableDeclarator",
          start: start + 6,
          end: start + 41,
          id: { type: "Identifier", start: start + 6, end: start + 7, name: "x" },
          init: {
            type: "ObjectExpression",
            start: start + 10,
            end: start + 41,
            properties: [ {
              type: "Property",
              start: start + 12,
              end: start + 39,
              method: false,
              shorthand: false,
              computed: false,
              key: { type: "Identifier", start: start + 12, end: start + 13, name: "y" },
              value: {
                type: "FunctionExpression",
                start: start + 15,
                end: start + 39,
                id: null,
                generator: false,
                expression: false,
                async: false,
                params: [],
                body: {
                  type: "BlockStatement",
                  start: start + 27,
                  end: start + 39,
                  body: [ {
                    type: "ExpressionStatement",
                    start: start + 29,
                    end: start + 37,
                    expression: {
                      type: "CallExpression",
                      start: start + 29,
                      end: start + 36,
                      callee: { type: "Super", start: start + 29, end: start + 34 },
                      arguments: [] } } ] } },
              kind: "init" } ] } } ],
        kind: "var" } ]
    }) },
  ].forEach(bodyInput => {
    const body = bodyInput.body, passes = bodyInput.passes, bodyAst = bodyInput.ast
    functions.forEach(input => {
      const text = input.text, options = input.options || {}, ast = input.ast;
      (passes ? test : testFail)(text.replace("%s", body), ast && ast(bodyAst), options)
    })
  })

  // Not yet fixed in acorn master
  //testFail("void \\u0061sync function* f(){};");

  // Fixed in acorn master
  //testFail("for ( ; false; ) async function* g() {}");
})
