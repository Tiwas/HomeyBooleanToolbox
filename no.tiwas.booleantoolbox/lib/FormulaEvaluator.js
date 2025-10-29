/**
 * AST-Based Formula Evaluator
 * 
 * Securely evaluates boolean formulas without using eval() or new Function()
 * by parsing expressions into an Abstract Syntax Tree (AST) and evaluating it.
 * 
 * Supported operators:
 * - AND: AND, &&, *, &
 * - OR: OR, ||, +, |
 * - XOR: XOR, ^, !=
 * - NOT: NOT, !
 * 
 * Supported values:
 * - Variables: A-J (case-insensitive)
 * - Literals: TRUE, FALSE, true, false, 1, 0
 * - Parentheses: ( )
 */

class FormulaEvaluator {
  constructor() {
    this.tokens = [];
    this.position = 0;
  }

  /**
   * Tokenize the expression into tokens
   * @param {string} expression - The formula expression to tokenize
   * @returns {Array} Array of tokens
   */
  tokenize(expression) {
    if (!expression || typeof expression !== 'string') {
      throw new Error('Expression must be a non-empty string');
    }

    const tokens = [];
    const expr = expression.trim();
    let i = 0;

    while (i < expr.length) {
      // Skip whitespace
      if (/\s/.test(expr[i])) {
        i++;
        continue;
      }

      // Parentheses
      if (expr[i] === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }
      if (expr[i] === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }

      // Two-character operators
      if (i < expr.length - 1) {
        const twoChar = expr.substring(i, i + 2);
        if (twoChar === '&&') {
          tokens.push({ type: 'AND', value: '&&' });
          i += 2;
          continue;
        }
        if (twoChar === '||') {
          tokens.push({ type: 'OR', value: '||' });
          i += 2;
          continue;
        }
        if (twoChar === '!=') {
          tokens.push({ type: 'XOR', value: '!=' });
          i += 2;
          continue;
        }
      }

      // Single-character operators
      if (expr[i] === '&') {
        tokens.push({ type: 'AND', value: '&' });
        i++;
        continue;
      }
      if (expr[i] === '*') {
        tokens.push({ type: 'AND', value: '*' });
        i++;
        continue;
      }
      if (expr[i] === '|') {
        tokens.push({ type: 'OR', value: '|' });
        i++;
        continue;
      }
      if (expr[i] === '+') {
        tokens.push({ type: 'OR', value: '+' });
        i++;
        continue;
      }
      if (expr[i] === '^') {
        tokens.push({ type: 'XOR', value: '^' });
        i++;
        continue;
      }
      if (expr[i] === '!') {
        tokens.push({ type: 'NOT', value: '!' });
        i++;
        continue;
      }

      
      // Keywords and variables (utvidet: [A-Z][A-Z0-9_]*)
      if (/[a-zA-Z]/.test(expr[i])) {

        let word = '';
        while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
          word += expr[i];
          i++;
        }

        const upper = word.toUpperCase();
        
        // Keywords
        if (upper === 'AND') {
          tokens.push({ type: 'AND', value: 'AND' });
        } else if (upper === 'OR') {
          tokens.push({ type: 'OR', value: 'OR' });
        } else if (upper === 'XOR') {
          tokens.push({ type: 'XOR', value: 'XOR' });
        } else if (upper === 'NOT') {
          tokens.push({ type: 'NOT', value: 'NOT' });
        } else if (upper === 'TRUE') {
          tokens.push({ type: 'LITERAL', value: true });
        } else if (upper === 'FALSE') {
          tokens.push({ type: 'LITERAL', value: false });
        
        } else if (/^[A-J]$/.test(upper) || /^[A-Z][A-Z0-9_]*$/.test(upper)) {
          // Variabler: enten en enkel A–J, eller et namespacet navn (F_FORMULA_1_A)
          tokens.push({ type: 'VARIABLE', value: upper });
        } else {
          throw new Error(`Invalid identifier: ${word}`);
        }

        continue;
      }

      // Numbers (0 or 1 as boolean literals)
      if (/[0-9]/.test(expr[i])) {
        const num = expr[i];
        if (num === '0') {
          tokens.push({ type: 'LITERAL', value: false });
        } else if (num === '1') {
          tokens.push({ type: 'LITERAL', value: true });
        } else {
          throw new Error(`Invalid number: ${num}. Only 0 and 1 are allowed.`);
        }
        i++;
        continue;
      }

      // Unknown character
      throw new Error(`Unexpected character: ${expr[i]}`);
    }

    return tokens;
  }

  /**
   * Parse tokens into an Abstract Syntax Tree (AST)
   * @param {Array} tokens - Array of tokens from tokenize()
   * @returns {Object} AST root node
   */
  parse(tokens) {
    this.tokens = tokens;
    this.position = 0;

    if (tokens.length === 0) {
      throw new Error('Empty expression');
    }

    const ast = this.parseOr();

    if (this.position < this.tokens.length) {
      throw new Error(`Unexpected token: ${this.tokens[this.position].value}`);
    }

    return ast;
  }

  /**
   * Parse OR expressions (lowest precedence)
   */
  parseOr() {
    let left = this.parseXor();

    while (this.position < this.tokens.length && this.tokens[this.position].type === 'OR') {
      this.position++;
      const right = this.parseXor();
      left = {
        type: 'BinaryOp',
        operator: 'OR',
        left: left,
        right: right
      };
    }

    return left;
  }

  /**
   * Parse XOR expressions
   */
  parseXor() {
    let left = this.parseAnd();

    while (this.position < this.tokens.length && this.tokens[this.position].type === 'XOR') {
      this.position++;
      const right = this.parseAnd();
      left = {
        type: 'BinaryOp',
        operator: 'XOR',
        left: left,
        right: right
      };
    }

    return left;
  }

  /**
   * Parse AND expressions
   */
  parseAnd() {
    let left = this.parseUnary();

    while (this.position < this.tokens.length && this.tokens[this.position].type === 'AND') {
      this.position++;
      const right = this.parseUnary();
      left = {
        type: 'BinaryOp',
        operator: 'AND',
        left: left,
        right: right
      };
    }

    return left;
  }

  /**
   * Parse unary expressions (NOT)
   */
  parseUnary() {
    if (this.position < this.tokens.length && this.tokens[this.position].type === 'NOT') {
      this.position++;
      const operand = this.parseUnary(); // Allow multiple NOTs
      return {
        type: 'UnaryOp',
        operator: 'NOT',
        operand: operand
      };
    }

    return this.parsePrimary();
  }

  /**
   * Parse primary expressions (literals, variables, parentheses)
   */
  parsePrimary() {
    if (this.position >= this.tokens.length) {
      throw new Error('Unexpected end of expression');
    }

    const token = this.tokens[this.position];

    // Parentheses
    if (token.type === 'LPAREN') {
      this.position++;
      const expr = this.parseOr();
      if (this.position >= this.tokens.length || this.tokens[this.position].type !== 'RPAREN') {
        throw new Error('Unbalanced parentheses');
      }
      this.position++;
      return expr;
    }

    // Literals
    if (token.type === 'LITERAL') {
      this.position++;
      return {
        type: 'Literal',
        value: token.value
      };
    }

    // Variables
    if (token.type === 'VARIABLE') {
      this.position++;
      return {
        type: 'Variable',
        name: token.value
      };
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  /**
   * Evaluate an AST with given variable values
   * @param {Object} ast - The AST to evaluate
   * @param {Object} variables - Object mapping variable names to boolean values
   * @returns {boolean} The result of the evaluation
   */
  evaluateAST(ast, variables = {}) {
    if (!ast) {
      throw new Error('Invalid AST');
    }

    switch (ast.type) {
      case 'Literal':
        return !!ast.value;

      case 'Variable':
        const val = variables[ast.name];
        // Throw error if variable is not defined - don't treat it as false
        if (val === undefined || val === "undefined") {
          throw new Error(`Variable ${ast.name} is not defined`);
        }
        return !!val;

      case 'UnaryOp':
        if (ast.operator === 'NOT') {
          return !this.evaluateAST(ast.operand, variables);
        }
        throw new Error(`Unknown unary operator: ${ast.operator}`);

      case 'BinaryOp':
        const left = this.evaluateAST(ast.left, variables);
        const right = this.evaluateAST(ast.right, variables);

        switch (ast.operator) {
          case 'AND':
            return left && right;
          case 'OR':
            return left || right;
          case 'XOR':
            return left !== right;
          default:
            throw new Error(`Unknown binary operator: ${ast.operator}`);
        }

      default:
        throw new Error(`Unknown AST node type: ${ast.type}`);
    }
  }

  /**
   * Validate and evaluate an expression
   * @param {string} expression - The formula expression
   * @param {Object} variables - Object mapping variable names to boolean values
   * @returns {boolean} The result of the evaluation
   */
  evaluate(expression, variables = {}) {
    const tokens = this.tokenize(expression);
    const ast = this.parse(tokens);
    return this.evaluateAST(ast, variables);
  }
}

module.exports = FormulaEvaluator;