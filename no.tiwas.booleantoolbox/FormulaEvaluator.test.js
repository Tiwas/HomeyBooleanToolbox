/**
 * Unit Tests for FormulaEvaluator
 * 
 * Run with: npm test
 */

const FormulaEvaluator = require('./lib/FormulaEvaluator');

describe('FormulaEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    evaluator = new FormulaEvaluator();
  });

  describe('Tokenization', () => {
    test('should tokenize simple expression', () => {
      const tokens = evaluator.tokenize('A AND B');
      expect(tokens).toEqual([
        { type: 'VARIABLE', value: 'A' },
        { type: 'AND', value: 'AND' },
        { type: 'VARIABLE', value: 'B' }
      ]);
    });

    test('should tokenize with various AND operators', () => {
      expect(evaluator.tokenize('A AND B')).toContainEqual({ type: 'AND', value: 'AND' });
      expect(evaluator.tokenize('A && B')).toContainEqual({ type: 'AND', value: '&&' });
      expect(evaluator.tokenize('A & B')).toContainEqual({ type: 'AND', value: '&' });
      expect(evaluator.tokenize('A * B')).toContainEqual({ type: 'AND', value: '*' });
    });

    test('should tokenize with various OR operators', () => {
      expect(evaluator.tokenize('A OR B')).toContainEqual({ type: 'OR', value: 'OR' });
      expect(evaluator.tokenize('A || B')).toContainEqual({ type: 'OR', value: '||' });
      expect(evaluator.tokenize('A | B')).toContainEqual({ type: 'OR', value: '|' });
      expect(evaluator.tokenize('A + B')).toContainEqual({ type: 'OR', value: '+' });
    });

    test('should tokenize with various XOR operators', () => {
      expect(evaluator.tokenize('A XOR B')).toContainEqual({ type: 'XOR', value: 'XOR' });
      expect(evaluator.tokenize('A ^ B')).toContainEqual({ type: 'XOR', value: '^' });
      expect(evaluator.tokenize('A != B')).toContainEqual({ type: 'XOR', value: '!=' });
    });

    test('should tokenize NOT operator', () => {
      expect(evaluator.tokenize('NOT A')).toContainEqual({ type: 'NOT', value: 'NOT' });
      expect(evaluator.tokenize('!A')).toContainEqual({ type: 'NOT', value: '!' });
    });

    test('should tokenize literals', () => {
      expect(evaluator.tokenize('TRUE')).toContainEqual({ type: 'LITERAL', value: true });
      expect(evaluator.tokenize('FALSE')).toContainEqual({ type: 'LITERAL', value: false });
      expect(evaluator.tokenize('true')).toContainEqual({ type: 'LITERAL', value: true });
      expect(evaluator.tokenize('false')).toContainEqual({ type: 'LITERAL', value: false });
      expect(evaluator.tokenize('1')).toContainEqual({ type: 'LITERAL', value: true });
      expect(evaluator.tokenize('0')).toContainEqual({ type: 'LITERAL', value: false });
    });

    test('should tokenize parentheses', () => {
      const tokens = evaluator.tokenize('(A AND B)');
      expect(tokens[0]).toEqual({ type: 'LPAREN', value: '(' });
      expect(tokens[4]).toEqual({ type: 'RPAREN', value: ')' });
    });

    test('should handle whitespace correctly', () => {
      const tokens1 = evaluator.tokenize('A AND B');
      const tokens2 = evaluator.tokenize('  A   AND   B  ');
      expect(tokens1).toEqual(tokens2);
    });

    test('should reject invalid variables', () => {
      expect(() => evaluator.tokenize('K AND L')).toThrow('Invalid identifier: K');
      expect(() => evaluator.tokenize('ABC')).toThrow('Invalid identifier: ABC');
    });

    test('should reject invalid numbers', () => {
      expect(() => evaluator.tokenize('2')).toThrow('Invalid number: 2');
      expect(() => evaluator.tokenize('123')).toThrow('Invalid number: 2'); // '1' is OK, '2' throws error
    });

    test('should reject empty expression', () => {
      expect(() => evaluator.tokenize('')).toThrow('Expression must be a non-empty string');
      expect(() => evaluator.tokenize(null)).toThrow('Expression must be a non-empty string');
    });

    test('should reject unexpected characters', () => {
      expect(() => evaluator.tokenize('A $ B')).toThrow('Unexpected character: $');
      expect(() => evaluator.tokenize('A @ B')).toThrow('Unexpected character: @');
    });
  });

  describe('Parsing', () => {
    test('should parse simple AND expression', () => {
      const tokens = evaluator.tokenize('A AND B');
      const ast = evaluator.parse(tokens);
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: 'AND',
        left: { type: 'Variable', name: 'A' },
        right: { type: 'Variable', name: 'B' }
      });
    });

    test('should parse simple OR expression', () => {
      const tokens = evaluator.tokenize('A OR B');
      const ast = evaluator.parse(tokens);
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: 'OR',
        left: { type: 'Variable', name: 'A' },
        right: { type: 'Variable', name: 'B' }
      });
    });

    test('should parse NOT expression', () => {
      const tokens = evaluator.tokenize('NOT A');
      const ast = evaluator.parse(tokens);
      expect(ast).toEqual({
        type: 'UnaryOp',
        operator: 'NOT',
        operand: { type: 'Variable', name: 'A' }
      });
    });

    test('should parse double NOT', () => {
      const tokens = evaluator.tokenize('NOT NOT A');
      const ast = evaluator.parse(tokens);
      expect(ast).toEqual({
        type: 'UnaryOp',
        operator: 'NOT',
        operand: {
          type: 'UnaryOp',
          operator: 'NOT',
          operand: { type: 'Variable', name: 'A' }
        }
      });
    });

    test('should parse parentheses', () => {
      const tokens = evaluator.tokenize('(A AND B)');
      const ast = evaluator.parse(tokens);
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: 'AND',
        left: { type: 'Variable', name: 'A' },
        right: { type: 'Variable', name: 'B' }
      });
    });

    test('should respect operator precedence: AND before OR', () => {
      const tokens = evaluator.tokenize('A OR B AND C');
      const ast = evaluator.parse(tokens);
      expect(ast.type).toBe('BinaryOp');
      expect(ast.operator).toBe('OR');
      expect(ast.right.type).toBe('BinaryOp');
      expect(ast.right.operator).toBe('AND');
    });

    test('should handle parentheses overriding precedence', () => {
      const tokens = evaluator.tokenize('(A OR B) AND C');
      const ast = evaluator.parse(tokens);
      expect(ast.type).toBe('BinaryOp');
      expect(ast.operator).toBe('AND');
      expect(ast.left.type).toBe('BinaryOp');
      expect(ast.left.operator).toBe('OR');
    });

    test('should reject unbalanced parentheses', () => {
      expect(() => {
        const tokens = evaluator.tokenize('(A AND B');
        evaluator.parse(tokens);
      }).toThrow('Unbalanced parentheses');

      expect(() => {
        const tokens = evaluator.tokenize('A AND B)');
        evaluator.parse(tokens);
      }).toThrow('Unexpected token: )');
    });

    test('should reject empty token list', () => {
      expect(() => evaluator.parse([])).toThrow('Empty expression');
    });

    test('should reject incomplete expression', () => {
      expect(() => {
        const tokens = evaluator.tokenize('A AND');
        evaluator.parse(tokens);
      }).toThrow('Unexpected end of expression');
    });
  });

  describe('AST Evaluation', () => {
    test('should evaluate simple AND expression', () => {
      const ast = {
        type: 'BinaryOp',
        operator: 'AND',
        left: { type: 'Variable', name: 'A' },
        right: { type: 'Variable', name: 'B' }
      };
      expect(evaluator.evaluateAST(ast, { A: true, B: true })).toBe(true);
      expect(evaluator.evaluateAST(ast, { A: true, B: false })).toBe(false);
      expect(evaluator.evaluateAST(ast, { A: false, B: true })).toBe(false);
      expect(evaluator.evaluateAST(ast, { A: false, B: false })).toBe(false);
    });

    test('should evaluate simple OR expression', () => {
      const ast = {
        type: 'BinaryOp',
        operator: 'OR',
        left: { type: 'Variable', name: 'A' },
        right: { type: 'Variable', name: 'B' }
      };
      expect(evaluator.evaluateAST(ast, { A: true, B: true })).toBe(true);
      expect(evaluator.evaluateAST(ast, { A: true, B: false })).toBe(true);
      expect(evaluator.evaluateAST(ast, { A: false, B: true })).toBe(true);
      expect(evaluator.evaluateAST(ast, { A: false, B: false })).toBe(false);
    });

    test('should evaluate XOR expression', () => {
      const ast = {
        type: 'BinaryOp',
        operator: 'XOR',
        left: { type: 'Variable', name: 'A' },
        right: { type: 'Variable', name: 'B' }
      };
      expect(evaluator.evaluateAST(ast, { A: true, B: true })).toBe(false);
      expect(evaluator.evaluateAST(ast, { A: true, B: false })).toBe(true);
      expect(evaluator.evaluateAST(ast, { A: false, B: true })).toBe(true);
      expect(evaluator.evaluateAST(ast, { A: false, B: false })).toBe(false);
    });

    test('should evaluate NOT expression', () => {
      const ast = {
        type: 'UnaryOp',
        operator: 'NOT',
        operand: { type: 'Variable', name: 'A' }
      };
      expect(evaluator.evaluateAST(ast, { A: true })).toBe(false);
      expect(evaluator.evaluateAST(ast, { A: false })).toBe(true);
    });

    test('should evaluate literals', () => {
      expect(evaluator.evaluateAST({ type: 'Literal', value: true })).toBe(true);
      expect(evaluator.evaluateAST({ type: 'Literal', value: false })).toBe(false);
    });

    test('should throw on undefined variable', () => {
      const ast = { type: 'Variable', name: 'A' };
      expect(() => evaluator.evaluateAST(ast, {})).toThrow('Undefined variable: A');
    });

    test('should handle truthy/falsy values correctly', () => {
      const ast = { type: 'Variable', name: 'A' };
      expect(evaluator.evaluateAST(ast, { A: 1 })).toBe(true);
      expect(evaluator.evaluateAST(ast, { A: 0 })).toBe(false);
      expect(evaluator.evaluateAST(ast, { A: 'true' })).toBe(true);
      expect(evaluator.evaluateAST(ast, { A: '' })).toBe(false);
    });
  });

  describe('Full Evaluation (End-to-End)', () => {
    test('should evaluate simple expressions', () => {
      expect(evaluator.evaluate('TRUE')).toBe(true);
      expect(evaluator.evaluate('FALSE')).toBe(false);
      expect(evaluator.evaluate('1')).toBe(true);
      expect(evaluator.evaluate('0')).toBe(false);
    });

    test('should evaluate AND expressions', () => {
      expect(evaluator.evaluate('A AND B', { A: true, B: true })).toBe(true);
      expect(evaluator.evaluate('A && B', { A: true, B: false })).toBe(false);
      expect(evaluator.evaluate('A & B', { A: false, B: true })).toBe(false);
      expect(evaluator.evaluate('A * B', { A: false, B: false })).toBe(false);
    });

    test('should evaluate OR expressions', () => {
      expect(evaluator.evaluate('A OR B', { A: true, B: true })).toBe(true);
      expect(evaluator.evaluate('A || B', { A: true, B: false })).toBe(true);
      expect(evaluator.evaluate('A | B', { A: false, B: true })).toBe(true);
      expect(evaluator.evaluate('A + B', { A: false, B: false })).toBe(false);
    });

    test('should evaluate XOR expressions', () => {
      expect(evaluator.evaluate('A XOR B', { A: true, B: false })).toBe(true);
      expect(evaluator.evaluate('A ^ B', { A: false, B: true })).toBe(true);
      expect(evaluator.evaluate('A != B', { A: true, B: true })).toBe(false);
    });

    test('should evaluate NOT expressions', () => {
      expect(evaluator.evaluate('NOT A', { A: true })).toBe(false);
      expect(evaluator.evaluate('!A', { A: false })).toBe(true);
      expect(evaluator.evaluate('NOT NOT A', { A: true })).toBe(true);
    });

    test('should evaluate complex expressions', () => {
      expect(evaluator.evaluate('(A OR B) AND C', { A: true, B: false, C: true })).toBe(true);
      expect(evaluator.evaluate('(A OR B) AND C', { A: false, B: false, C: true })).toBe(false);
      expect(evaluator.evaluate('A AND (B OR C)', { A: true, B: false, C: true })).toBe(true);
      expect(evaluator.evaluate('NOT (A AND B)', { A: true, B: false })).toBe(true);
    });

    test('should evaluate real-world formula examples', () => {
      // Example: Door locked = (door closed) AND NOT (motion detected)
      expect(
        evaluator.evaluate('A AND NOT B', { A: true, B: false })
      ).toBe(true);
      
      expect(
        evaluator.evaluate('A AND NOT B', { A: true, B: true })
      ).toBe(false);

      // Example: Alarm triggered = (window open) OR (door open) AND NOT (system disabled)
      expect(
        evaluator.evaluate('(A OR B) AND NOT C', { A: false, B: true, C: false })
      ).toBe(true);

      // Example: All doors closed = door1 AND door2 AND door3
      expect(
        evaluator.evaluate('A AND B AND C', { A: true, B: true, C: true })
      ).toBe(true);
      
      expect(
        evaluator.evaluate('A AND B AND C', { A: true, B: false, C: true })
      ).toBe(false);
    });

    test('should handle case-insensitive variables', () => {
      expect(evaluator.evaluate('a AND b', { A: true, B: true })).toBe(true);
      expect(evaluator.evaluate('A and B', { A: true, B: true })).toBe(true);
    });

    test('should handle mixed operators', () => {
      expect(evaluator.evaluate('A * B + C', { A: true, B: true, C: false })).toBe(true);
      expect(evaluator.evaluate('A & B | C', { A: false, B: true, C: false })).toBe(false);
    });

    test('should handle deeply nested expressions', () => {
      expect(
        evaluator.evaluate('((A AND B) OR (C AND D)) AND NOT E', {
          A: true, B: true, C: false, D: true, E: false
        })
      ).toBe(true);
    });

    test('should respect operator precedence', () => {
      // AND has higher precedence than OR
      expect(evaluator.evaluate('A OR B AND C', { A: false, B: true, C: true })).toBe(true);
      expect(evaluator.evaluate('A OR B AND C', { A: false, B: true, C: false })).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input types', () => {
      expect(() => evaluator.evaluate(123)).toThrow();
      expect(() => evaluator.evaluate(null)).toThrow();
      expect(() => evaluator.evaluate(undefined)).toThrow();
      expect(() => evaluator.evaluate({})).toThrow();
    });

    test('should handle syntax errors', () => {
      expect(() => evaluator.evaluate('A AND')).toThrow();
      expect(() => evaluator.evaluate('AND A')).toThrow();
      expect(() => evaluator.evaluate('A B')).toThrow();
      expect(() => evaluator.evaluate('(A AND B')).toThrow();
      expect(() => evaluator.evaluate('A AND B)')).toThrow();
    });

    test('should handle invalid operators', () => {
      expect(() => evaluator.evaluate('A $ B')).toThrow();
      expect(() => evaluator.evaluate('A @ B')).toThrow();
    });

    test('should handle undefined variables', () => {
      expect(() => evaluator.evaluate('A AND B', { A: true })).toThrow('Undefined variable: B');
    });

    test('should provide meaningful error messages', () => {
      expect(() => evaluator.evaluate('K')).toThrow(/Invalid identifier/);
      expect(() => evaluator.evaluate('(A AND B')).toThrow(/Unbalanced parentheses/);
      expect(() => evaluator.evaluate('A AND B', { A: true })).toThrow(/Undefined variable/);
    });
  });

  describe('Edge Cases', () => {
    test('should handle all valid variables A-J', () => {
      const vars = { A: true, B: false, C: true, D: false, E: true, F: false, G: true, H: false, I: true, J: false };
      expect(evaluator.evaluate('A', vars)).toBe(true);
      expect(evaluator.evaluate('J', vars)).toBe(false);
      expect(evaluator.evaluate('A AND C AND E AND G AND I', vars)).toBe(true);
    });

    test('should handle expressions with only literals', () => {
      expect(evaluator.evaluate('TRUE AND TRUE')).toBe(true);
      expect(evaluator.evaluate('TRUE AND FALSE')).toBe(false);
      expect(evaluator.evaluate('1 AND 1')).toBe(true);
      expect(evaluator.evaluate('1 OR 0')).toBe(true);
    });

    test('should handle long expressions', () => {
      const expr = 'A AND B AND C AND D AND E AND F AND G AND H AND I AND J';
      const vars = { A: true, B: true, C: true, D: true, E: true, F: true, G: true, H: true, I: true, J: true };
      expect(evaluator.evaluate(expr, vars)).toBe(true);
      
      vars.E = false;
      expect(evaluator.evaluate(expr, vars)).toBe(false);
    });

    test('should handle multiple levels of parentheses', () => {
      expect(evaluator.evaluate('((((A))))', { A: true })).toBe(true);
      expect(evaluator.evaluate('(((A AND B)))', { A: true, B: true })).toBe(true);
    });

    test('should handle single variable', () => {
      expect(evaluator.evaluate('A', { A: true })).toBe(true);
      expect(evaluator.evaluate('A', { A: false })).toBe(false);
    });

    test('should handle whitespace variations', () => {
      expect(evaluator.evaluate('A AND B', { A: true, B: true })).toBe(true);
      expect(evaluator.evaluate('  A   AND   B  ', { A: true, B: true })).toBe(true);
      expect(evaluator.evaluate('A AND B', { A: true, B: true })).toBe(true);
      expect(evaluator.evaluate('A AND\nB', { A: true, B: true })).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should handle reasonable expression complexity', () => {
      const expr = '(A AND B) OR (C AND D) OR (E AND F) OR (G AND H)';
      const vars = { A: true, B: false, C: false, D: true, E: true, F: true, G: false, H: false };
      
      const start = Date.now();
      const result = evaluator.evaluate(expr, vars);
      const duration = Date.now() - start;
      
      expect(result).toBe(true);
      expect(duration).toBeLessThan(10); // Should complete in less than 10ms
    });
  });
});