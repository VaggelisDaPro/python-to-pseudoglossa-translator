const varTypePlural = {
  int: "ΑΚΕΡΑΙΕΣ",
  float: "ΠΡΑΓΜΑΤΙΚΕΣ",
  str: "ΧΑΡΑΚΤΗΡΕΣ",
  bool: "ΛΟΓΙΚΕΣ"
};

const returnTypeMap = {
  int: "ΑΚΕΡΑΙΑ",
  float: "ΠΡΑΓΜΑΤΙΚΗ",
  str: "ΧΑΡΑΚΤΗΡΑΣ",
  bool: "ΛΟΓΙΚΗ"
};

const greekToKey = {
  "ΑΚΕΡΑΙΕΣ": "int",
  "ΠΡΑΓΜΑΤΙΚΕΣ": "float",
  "ΧΑΡΑΚΤΗΡΕΣ": "str",
  "ΛΟΓΙΚΕΣ": "bool",
  "ΑΚΕΡΑΙΑ": "int",
  "ΠΡΑΓΜΑΤΙΚΗ": "float",
  "ΧΑΡΑΚΤΗΡΑΣ": "str",
  "ΛΟΓΙΚΗ": "bool"
};

function normalizeTypeKey(t) {
  if (!t && t !== "") return null;
  if (typeof t === "string") {
    const lower = t.toLowerCase();
    if (["int", "float", "str", "bool"].includes(lower)) return lower;
    if (greekToKey[t]) return greekToKey[t];
    if (["INT", "FLOAT", "STR", "BOOL"].includes(t.toUpperCase())) return t.toLowerCase();
  }
  return null;
}

export function getAlgName(lines, language) {
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^ALG_NAME\s*=\s*(['"])(.*?)\1/);
    if (!m || !m[2]) continue;
    const name = m[2].trim().toUpperCase();
    if (/^\d/.test(name)) throw new Error(`Invalid algorithm name: '${name}' cannot start with a digit`);
    if (!/^[\p{Script=Latin}\p{Script=Greek}0-9_]+$/u.test(name)) throw new Error(`Invalid algorithm name: '${name}' contains invalid characters`);
    return m[2];
  }
  return "ΔΟΚΙΜΗ";
}

function isValidIdentifier(name) {
  const upper = name.toUpperCase();
  if (/^\d/.test(upper)) return false;
  if (!/^[\p{Script=Latin}\p{Script=Greek}0-9_]+$/u.test(upper)) return false;
  return true;
}

export function analyze(lines) {
  const variables = {};
  const statements = [];

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^ALG_NAME\s*=/i.test(line)) continue;

    let m = line.match(/^(\w+)\s*:\s*(.+)$/u);
    if (m) {
      const givenTypeGreek = m[1].trim();
      const typeKey = normalizeTypeKey(givenTypeGreek);
      if (!typeKey) throw new Error(`Unknown type: '${givenTypeGreek}'`);
      const vars = m[2].split(",").map(v => v.trim());
      for (const name of vars) {
        if (!isValidIdentifier(name)) throw new Error(`Invalid variable name: '${name}'`);
        variables[name] = { type: typeKey, inferred: false };
      }
      continue;
    }

    m = line.match(/^([\p{L}\p{N}_]+)\s*=\s*input\s*\(\s*\)\s*$/u);
    if (m) {
      const name = m[1];
      if (!isValidIdentifier(name)) throw new Error(`Invalid variable name: '${name}'`);
      variables[name] = variables[name] || { type: "str", inferred: true };
      statements.push({ type: "input", target: name });
      continue;
    }

    m = line.match(/^([\p{L}\p{N}_]+)\s*=\s*(['"]).*\2$/u);
    if (m) {
      const name = m[1];
      if (!isValidIdentifier(name)) throw new Error(`Invalid variable name: '${name}'`);
      variables[name] = { type: "str", inferred: false };
      statements.push({ type: "assign", target: name, valueType: "STRING" });
      continue;
    }

    m = line.match(/^([\p{L}\p{N}_]+)\s*=\s*(\d+(\.\d+)?)$/u);
    if (m) {
      const name = m[1];
      const isFloat = !!m[3];
      variables[name] = { type: isFloat ? "float" : "int", inferred: false };
      statements.push({ type: "assign", target: name, valueType: "NUMBER" });
      continue;
    }

    m = line.match(/^([\p{L}\p{N}_]+)\s*=\s*(True|False)$/u);
    if (m) {
      const name = m[1];
      if (!isValidIdentifier(name)) throw new Error(`Invalid variable name: '${name}'`);
      variables[name] = { type: "bool", inferred: false };
      statements.push({ type: "assign", target: name, valueType: "BOOLEAN", value: m[2] });
      continue;
    }
  }

  return { variables, statements };
}

class TypeInferrer {
  constructor() {
    this.variableTypes = new Map();
    this.functionReturnTypes = new Map();
    this.functionParamTypes = new Map();
  }

  inferExpressionType(expr, localVars = {}) {
    if (!expr || typeof expr !== "string") return null;
    
    const s = expr.trim();
    
    if (/^\d+$/.test(s)) return "int";
    if (/^\d+\.\d+$/.test(s)) return "float";
    if (/^(['"]).*\1$/.test(s)) return "str";
    if (/^(True|False)$/.test(s)) return "bool";
    
    const varMatch = s.match(/^[\p{L}\p{N}_]+$/u);
    if (varMatch) {
      const varName = s;
      if (localVars[varName] && localVars[varName].type) {
        return normalizeTypeKey(localVars[varName].type);
      }
      if (this.variableTypes.has(varName)) {
        return this.variableTypes.get(varName);
      }
      return null;
    }
    
    const comparisonMatch = s.match(/^(.+?)\s*(<|>|<=|>=|=|<>)\s*(.+)$/);
    if (comparisonMatch) {
      return "bool";
    }
    
    const logicalMatch = s.match(/^(.+?)\s+(and|or)\s+(.+)$/i);
    if (logicalMatch) {
      return "bool";
    }
    
    const notMatch = s.match(/^not\s+(.+)$/i);
    if (notMatch) {
      return "bool";
    }
    
    const arithmeticMatch = s.match(/^(.+?)\s*([+\-*/%])\s*(.+)$/);
    if (arithmeticMatch) {
      const left = this.inferExpressionType(arithmeticMatch[1], localVars);
      const right = this.inferExpressionType(arithmeticMatch[3], localVars);
      const op = arithmeticMatch[2];
      
      if (op === "+" && (left === "str" || right === "str")) {
        return null;
      }
      
      if (!left || !right) return null;
      
      if (op === "/") {
        return "float";
      }
      
      if (left === "float" || right === "float") {
        return "float";
      }
      
      return "int";
    }
    
    const callMatch = s.match(/^([\p{L}_][\p{L}\p{N}_]*)\(([^)]*)\)$/u);
    if (callMatch) {
      const funcName = callMatch[1];
      return this.functionReturnTypes.get(funcName) || null;
    }
    
    return null;
  }

  processFunctionBody(body, functionName, localVars, isMain = false) {
    for (const node of body) {
      if (!node) continue;
      
      switch (node.type) {
        case "assign":
          if (node.target === functionName) {
            const returnType = this.inferExpressionType(node.value, localVars);
            if (returnType) {
              this.functionReturnTypes.set(functionName, returnType);
            }
          } else {
            const varType = this.inferExpressionType(node.value, localVars);
            if (varType) {
              this.variableTypes.set(node.target, varType);
              if (localVars[node.target]) {
                localVars[node.target].type = varType;
              }
            }
          }
          break;
          
        case "if":
          if (node.body) this.processFunctionBody(node.body, functionName, localVars);
          for (const elif of node.elifs || []) {
            if (elif.body) this.processFunctionBody(elif.body, functionName, localVars);
          }
          if (node.elseBody) this.processFunctionBody(node.elseBody, functionName, localVars);
          break;
          
        case "while":
        case "for":
          if (node.body) this.processFunctionBody(node.body, functionName, localVars);
          break;
          
        case "match":
          for (const c of node.cases || []) {
            if (c.body) this.processFunctionBody(c.body, functionName, localVars);
          }
          if (node.defaultBody) this.processFunctionBody(node.defaultBody, functionName, localVars);
          break;
          
        case "call":
          if (node.name === functionName) {
            break;
          }
          const funcParams = this.functionParamTypes.get(node.name) || [];
          const args = node.args || [];
          
          for (let i = 0; i < Math.min(args.length, funcParams.length); i++) {
            const argType = this.inferExpressionType(args[i], localVars);
            if (argType) {
              funcParams[i] = argType;
            }
          }
          this.functionParamTypes.set(node.name, funcParams);
          break;
      }
    }
  }

  analyzeFunction(fnode, callSites = []) {
    const localVars = { ...(fnode.variables || {}) };
    
    if (fnode.returnType) {
      this.functionReturnTypes.set(fnode.name, normalizeTypeKey(fnode.returnType));
    }
    
    const params = fnode.params || [];
    for (const param of params) {
      if (!localVars[param.name]) {
        localVars[param.name] = { type: null };
      }
    }
    
    for (const param of params) {
      if (param.type) {
        const typeKey = normalizeTypeKey(param.type);
        if (typeKey) {
          localVars[param.name].type = typeKey;
          this.variableTypes.set(param.name, typeKey);
        }
      }
    }
    
    for (const callSite of callSites) {
      if (callSite.name === fnode.name) {
        const args = callSite.args || [];
        for (let i = 0; i < Math.min(args.length, params.length); i++) {
          if (!params[i].type) {
            const argType = this.inferExpressionType(args[i], {});
            if (argType) {
              params[i].type = argType;
              localVars[params[i].name].type = argType;
            }
          }
        }
      }
    }
    
    for (let i = 0; i < params.length; i++) {
      if (!params[i].type) {
        params[i].type = "int";
      }
      if (!localVars[params[i].name].type) {
        localVars[params[i].name].type = params[i].type;
      }
      if (!this.variableTypes.has(params[i].name)) {
        this.variableTypes.set(params[i].name, params[i].type);
      }
    }
    
    this.processFunctionBody(fnode.body || [], fnode.name, localVars);
    
    if (!this.functionReturnTypes.has(fnode.name) && fnode.returnType) {
      this.functionReturnTypes.set(fnode.name, normalizeTypeKey(fnode.returnType));
    }
    
    fnode.params = params;
    fnode.variables = localVars;
    
    if (this.functionReturnTypes.has(fnode.name)) {
      fnode.inferredReturn = this.functionReturnTypes.get(fnode.name);
    }
  }
}

export function analyzeAst(ast, algname, globals = null) {
  const renameMap = new Map();
  renameMap.set(algname, `var_${algname}`);
  
  const typeInferrer = new TypeInferrer();
  
  if (globals) {
    for (const [name, info] of Object.entries(globals)) {
      if (name === "ALG_NAME") continue;
      const typeKey = normalizeTypeKey(info.type);
      if (typeKey) {
        typeInferrer.variableTypes.set(name, typeKey);
      }
    }
  }
  
  const functions = [];
  const calls = [];
  
  for (const node of ast) {
    if (node && node.type === "function") {
      functions.push(node);
    }
    if (node && node.type === "call") {
      calls.push(node);
    }
    if (node && node.type === "assign") {
      const type = typeInferrer.inferExpressionType(node.value, {});
      if (type) {
        typeInferrer.variableTypes.set(node.target, type);
      }
    }
  }
  
  for (const func of functions) {
    const funcCalls = calls.filter(call => call.name === func.name);
    typeInferrer.analyzeFunction(func, funcCalls);
  }
  
  for (const func of functions) {
    for (const param of func.params || []) {
      if (!param.type) {
        param.type = "int";
      }
      if (func.variables && func.variables[param.name]) {
        func.variables[param.name].type = param.type;
      }
    }
    
    if (!func.inferredReturn && !func.returnType) {
      let foundReturn = false;
      const scanForReturn = (nodes) => {
        for (const node of nodes) {
          if (!node) continue;
          if (node.type === "assign" && node.target === func.name) {
            foundReturn = true;
            const returnType = typeInferrer.inferExpressionType(node.value, func.variables || {});
            if (returnType) {
              func.inferredReturn = returnType;
            }
            return;
          }
          if (node.type === "if") {
            scanForReturn(node.body || []);
            for (const e of node.elifs || []) scanForReturn(e.body || []);
            if (node.elseBody) scanForReturn(node.elseBody || []);
          } else if (node.type === "while" || node.type === "for") {
            scanForReturn(node.body || []);
          } else if (node.type === "match") {
            for (const c of node.cases || []) scanForReturn(c.body || []);
            if (node.defaultBody) scanForReturn(node.defaultBody || []);
          }
        }
      };
      scanForReturn(func.body || []);
      
      if (!func.inferredReturn && foundReturn) {
        func.inferredReturn = "int";
      }
    }
  }
  
  function rewriteNode(node) {
    if (!node || typeof node !== "object") return node;
    const replaceVars = str => {
      if (!str || typeof str !== "string") return str;
      for (const [from, to] of renameMap) {
        const re = new RegExp(`\\b${from}\\b`, "g");
        str = str.replace(re, to);
      }
      return str;
    };

    switch (node.type) {
      case "assign":
        return { ...node, target: renameMap.get(node.target) ?? node.target, value: replaceVars(node.value) };
      case "input":
        return { ...node, target: renameMap.get(node.target) ?? node.target };
      case "print":
        return { ...node, args: replaceVars(node.args) };
      case "call":
        return { ...node, name: renameMap.get(node.name) ?? node.name, args: (node.args || []).map(a => replaceVars(a)) };
      case "if":
        return {
          ...node,
          condition: replaceVars(node.condition),
          body: (node.body || []).map(n => rewriteNode(n)),
          elifs: (node.elifs || []).map(e => ({ condition: replaceVars(e.condition), body: (e.body || []).map(n => rewriteNode(n)) })),
          elseBody: node.elseBody ? node.elseBody.map(n => rewriteNode(n)) : null
        };
      case "while":
        return { ...node, condition: replaceVars(node.condition), body: (node.body || []).map(n => rewriteNode(n)) };
      case "for":
        return {
          ...node,
          iterator: renameMap.get(node.iterator) ?? node.iterator,
          start: replaceVars(node.start),
          end: replaceVars(node.end),
          step: node.step ? replaceVars(node.step) : null,
          body: (node.body || []).map(n => rewriteNode(n))
        };
      case "match":
        return {
          ...node,
          subject: replaceVars(node.subject),
          cases: (node.cases || []).map(c => ({ pattern: replaceVars(c.pattern), body: (c.body || []).map(n => rewriteNode(n)) })),
          defaultBody: node.defaultBody ? node.defaultBody.map(n => rewriteNode(n)) : null
        };
      case "function": {
        const newName = renameMap.get(node.name) ?? node.name;
        const newVars = {};
        for (const [k, v] of Object.entries(node.variables || {})) {
          const nk = renameMap.get(k) ?? k;
          newVars[nk] = { ...v };
        }
        const newParams = (node.params || []).map(p => ({ name: renameMap.get(p.name) ?? p.name, type: p.type }));
        const newBody = (node.body || []).map(n => rewriteNode(n));
        return { ...node, name: newName, params: newParams, variables: newVars, body: newBody };
      }
      default: {
        const copy = { ...node };
        for (const k of Object.keys(copy)) {
          if (typeof copy[k] === "string") copy[k] = replaceVars(copy[k]);
          else if (Array.isArray(copy[k])) copy[k] = copy[k].map(x => (typeof x === "string" ? replaceVars(x) : x));
        }
        return copy;
      }
    }
  }

  const newAst = ast.map(n => rewriteNode(n));
  return newAst;
}