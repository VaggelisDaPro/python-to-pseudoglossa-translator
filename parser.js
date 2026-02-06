export function parse(lines, currentFunctionName = null) {
  const ast = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    let m = line.match(/^return\s+(.*)$/);
    if (m) {
      const expr = m[1].trim();
      if (currentFunctionName) {
        ast.push({ type: "assign", target: currentFunctionName, value: expr });
      } else {
        ast.push({ type: "return", value: expr });
      }
      continue;
    }

    m = line.match(/^print\s*\((f)?(.*)\)$/);
    if (m) {
      const hasF = m[1] === "f";
      const content = m[2].trim();
      if (hasF) ast.push({ type: "print", args: content, isFString: true });
      else ast.push({ type: "print", args: content });
      continue;
    }

    m = line.match(/^([\p{L}\p{N}_][\p{L}\p{N}_]*)\s*=\s*input\([^)]*\)\s*$/u);
    if (m) {
      ast.push({ type: "input", target: m[1].trim() });
      continue;
    }

    m = line.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*\(([^)]*)\)\s*$/u);
    if (m) {
      const name = m[1];
      const args = m[2].trim() === "" ? [] : m[2].split(",").map(a => a.trim());
      ast.push({ type: "call", name, args });
      continue;
    }

    m = line.match(/^([\p{L}\p{N}_][\p{L}\p{N}_]*)\s*=\s*(.+)$/u);
    if (m) {
      const name = m[1];
      const value = m[2].trim();
      if (name.toUpperCase() === "ALG_NAME") continue;
      ast.push({ type: "assign", target: name, value: value });
      continue;
    }

    m = line.match(/^if\s+(.*?)\s*:\s*$/);
    if (m) {
      const condition = m[1].replace("==", "=").replace("!=", "<>");
      const indentLevel = getIndent(raw);
      const { bodyLines, nextIndex } = collectIndentedBlock(lines, i + 1, indentLevel);
      i = nextIndex;
      const bodyAst = parse(bodyLines, currentFunctionName);
      const elifs = [];
      let elseBody = null;
      while (i + 1 < lines.length) {
        const nextRaw = lines[i + 1];
        const nextTrimmed = nextRaw.trim();
        if (nextTrimmed === "") {
          i++;
          continue;
        }
        if (getIndent(nextRaw) !== indentLevel) break;
        let m2 = nextTrimmed.match(/^elif\s+(.*?)\s*:\s*$/);
        if (m2) {
          i++;
          const res = collectIndentedBlock(lines, i + 1, indentLevel);
          i = res.nextIndex;
          elifs.push({ condition: m2[1], body: parse(res.bodyLines, currentFunctionName) });
          continue;
        }
        if (nextTrimmed === "else:") {
          i++;
          const res = collectIndentedBlock(lines, i + 1, indentLevel);
          i = res.nextIndex;
          elseBody = parse(res.bodyLines, currentFunctionName);
          break;
        }
        break;
      }
      ast.push({ type: "if", condition: condition, body: bodyAst, elifs, elseBody });
      continue;
    }

    m = line.match(/^while\s*(.*?)\s*:\s*$/);
    if (m) {
      const condition = m[1].replace("==", "=").replace("!=", "<>");
      const indentLevel = getIndent(raw);
      const { bodyLines, nextIndex } = collectIndentedBlock(lines, i + 1, indentLevel);
      i = nextIndex;
      const bodyAst = parse(bodyLines, currentFunctionName);
      ast.push({ type: "while", condition, body: bodyAst });
      continue;
    }

    m = line.match(/^for\s+([\p{L}\p{N}_]+)\s+in\s+range\s*\(([^)]*)\)\s*:\s*$/u);
    if (m) {
      const iterator = m[1];
      const rangeArgs = m[2].split(",").map(s => s.trim());
      let start, end, step;
      if (rangeArgs.length === 1) {
        start = "0"; end = rangeArgs[0]; step = null;
      } else if (rangeArgs.length === 2) {
        start = rangeArgs[0]; end = rangeArgs[1]; step = null;
      } else if (rangeArgs.length === 3) {
        start = rangeArgs[0]; end = rangeArgs[1]; step = rangeArgs[2];
      } else {
        throw new Error("Invalid range() in for loop");
      }
      const indentLevel = getIndent(raw);
      const res = collectIndentedBlock(lines, i + 1, indentLevel);
      i = res.nextIndex;
      ast.push({ type: "for", iterator, start, end, step, body: parse(res.bodyLines, currentFunctionName) });
      continue;
    }

    m = line.match(/^match\s+(.*?)\s*:\s*$/);
    if (m) {
      const subject = m[1].trim();
      const indentLevel = getIndent(raw);
      const res = collectIndentedBlock(lines, i + 1, indentLevel);
      i = res.nextIndex;
      const cases = [];
      let defaultBody = null;
      let j = 0;
      while (j < res.bodyLines.length) {
        const rawLine = res.bodyLines[j];
        if (rawLine.trim() === "") { j++; continue; }
        const trimmed = rawLine.trim();
        let mCase = trimmed.match(/^case\s+_\s*:\s*$/);
        if (mCase) {
          const cb = collectIndentedBlock(res.bodyLines, j + 1, getIndent(rawLine));
          defaultBody = parse(cb.bodyLines, currentFunctionName);
          j = cb.nextIndex + 1;
          continue;
        }
        mCase = trimmed.match(/^case\s+(.*?)\s*:\s*$/);
        if (mCase) {
          const pattern = mCase[1].trim();
          const cb = collectIndentedBlock(res.bodyLines, j + 1, getIndent(rawLine));
          cases.push({ pattern, body: parse(cb.bodyLines, currentFunctionName) });
          j = cb.nextIndex + 1;
          continue;
        }
        throw new Error(`Invalid match syntax: ${trimmed}`);
      }
      ast.push({ type: "match", subject, cases, defaultBody });
      continue;
    }

    m = line.match(/^def\s+([\p{L}_][\p{L}\p{N}_]*)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/u);
    if (m) {
      const name = m[1];
      const paramsRaw = m[2];
      let returnType = m[3] ? m[3].trim() : null;
      if (returnType === "None") returnType = null;
      const indentLevel = getIndent(lines[i]);
      const { bodyLines, nextIndex } = collectIndentedBlock(lines, i + 1, indentLevel);
      i = nextIndex;
      let localVars = {};
      let firstNonEmpty = 0;
      while (firstNonEmpty < bodyLines.length && bodyLines[firstNonEmpty].trim() === "") firstNonEmpty++;
      if (firstNonEmpty < bodyLines.length && bodyLines[firstNonEmpty].trim().toUpperCase().startsWith("ΜΕΤΑΒΛΗΤΕΣ")) {
        const { varsObj, consumed } = extractVariablesFromLines(bodyLines, firstNonEmpty + 1);
        localVars = varsObj;
        bodyLines.splice(firstNonEmpty, consumed + 1);
      }
      const bodyAst = parse(bodyLines, name);
      
      const paramObjs = [];
      if (paramsRaw.trim() !== "") {
        const paramList = paramsRaw.split(",").map(p => p.trim());
        for (const param of paramList) {
          const typeMatch = param.match(/^([\p{L}\p{N}_]+)\s*:\s*(\w+)$/u);
          if (typeMatch) {
            paramObjs.push({ name: typeMatch[1].trim(), type: typeMatch[2].trim().toLowerCase() });
          } else {
            paramObjs.push({ name: param, type: null });
          }
        }
      }
      
      ast.push({ type: "function", name, params: paramObjs, returnType, variables: localVars, body: bodyAst });
      continue;
    }
  }

  return ast;
}

function getIndent(line) {
  return line.match(/^(\s*)/)[1].length;
}

function collectIndentedBlock(lines, startIndex, baseIndent) {
  const bodyLines = [];
  let i = startIndex;
  while (i < lines.length) {
    const rawLine = lines[i];
    if (rawLine.trim() === "") {
      bodyLines.push(rawLine);
      i++;
      continue;
    }
    const indent = getIndent(rawLine);
    if (indent <= baseIndent) break;
    bodyLines.push(rawLine);
    i++;
  }
  return { bodyLines, nextIndex: i - 1 };
}

function extractVariablesFromLines(lines, start) {
  const varsObj = {};
  let i = start;
  for (; i < lines.length; i++) {
    const tline = lines[i].trim();
    if (tline === "") { i++; continue; }
    const m = tline.match(/^([\p{L}0-9_]+)\s*:\s*(.+)$/u);
    if (!m) break;
    const typeName = m[1].trim();
    const names = m[2].split(",").map(s => s.trim()).filter(Boolean);
    for (const nm of names) {
      varsObj[nm] = { type: typeName };
    }
  }
  return { varsObj, consumed: i - start };
}