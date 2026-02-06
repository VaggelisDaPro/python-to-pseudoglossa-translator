const mathMap = {
    "math.sqrt": "Τ_Ρ",
    "math.sin": "ΗΜ",
    "math.cos": "ΣΥΝ",
    "math.tan": "ΕΦ",
    "math.log": "ΛΟΓ",
    "math.exp": "E",
    "math.abs": "Α_Τ"
};

export function emit(ast, indent = 0) {
    let output = "";
  
    for (const node of ast) {
        switch (node.type) {
            case "print":
                let args = node.args;

                if (node.isFString) {
                    const strip = args.match(/^(['"]{1,3})([\s\S]*)\1$/);
                    const raw = strip ? strip[2] : args;

                    const parts = raw.split(/(\{[^}]*\})/g).filter(Boolean);

                    args = parts.map(p => {
                        if (p.startsWith("{") && p.endsWith("}")) {
                            return translateExpression(p.slice(1, -1).trim());
                        } else {
                            return JSON.stringify(p.trim());
                        }
                    }).join(", ");
                } else {
                    args = translateExpression(escapeChars(args));
                }
                output += `${pad(indent)}<span class="func">ΓΡΑΨΕ</span> ${args}\n`;
                break;
    
            case "input":
                output += `${pad(indent)}<span class="func">ΔΙΑΒΑΣΕ</span> ${node.target}\n`;
                break;
    
            case "assign":
                if (node.value.startsWith("input(")) continue;
                output += `${pad(indent)}${node.target} &lt;- ${translateExpression(node.value)}\n`;
                break;

            case "if":
                output += `${pad(indent)}<span class="func">ΑΝ</span> ${translateExpression(node.condition)} <span class="func">ΤΟΤΕ</span>\n`;

                // IF body
                output += emit(node.body, indent + 1);

                // ELIFs
                for (const e of node.elifs) {
                    output += `${pad(indent)}<span class="func">ΑΛΛΙΩΣ_ΑΝ</span> ${translateExpression(e.condition)} <span class="func">ΤΟΤΕ</span>\n`;
                    output += emit(e.body, indent + 1);
                }

                // ELSE
                if (node.elseBody) {
                    output += `${pad(indent)}<span class="func">ΑΛΛΙΩΣ</span>\n`;
                    output += emit(node.elseBody, indent + 1);
                }

                output += `${pad(indent)}<span class="func">ΤΕΛΟΣ_ΑΝ</span>\n`;
                break;

            case "while":
                output += `${pad(indent)}<span class="func">ΟΣΟ</span> ${node.condition} <span class="func">ΕΠΑΝΑΛΑΒΕ</span>\n`;
                output += emit(node.body, indent + 1);

                output += `${pad(indent)}<span class="func">ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ</span>\n`;
                break;
            
            case "for":
                output += `${pad(indent)}<span class="func">ΓΙΑ</span> ${node.iterator} `
                    + `<span class="func">ΑΠΟ</span> ${translateExpression(node.start)} `
                    + `<span class="func">ΜΕΧΡΙ</span> ${translateExpression(node.end)}`;

                if (node.step) {
                    output += ` <span class="func">ΜΕ_ΒΗΜΑ</span> ${translateExpression(node.step)}`;
                }

                output += "\n";
                output += emit(node.body, indent + 1);
                output += `${pad(indent)}<span class="func">ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ</span>\n`;
                break;

            case "match":
                output += `${pad(indent)}<span class="func">ΕΠΙΛΕΞΕ</span> ${translateExpression(node.subject)}\n`;

                for (const c of node.cases) {
                    output += `${pad(indent + 1)}<span class="func">ΠΕΡΙΠΤΩΣΗ</span> ${translateExpression(c.pattern)}\n`;
                    output += emit(c.body, indent + 2);
                }

                if (node.defaultBody) {
                    output += `${pad(indent + 1)}<span class="func">ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ</span>\n`;
                    output += emit(node.defaultBody, indent + 2);
                }

                output += `${pad(indent)}<span class="func">ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ</span>\n`;
                break;

            default:
                console.warn("Unknown AST node:", node);
        }
    }
  
    return output;
}

function pad(n) {
    return "    ".repeat(n);
}

function escapeChars(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;");
}

function translateExpression(expr) {
    let out = "";
    let i = 0;

    for (const [py, gr] of Object.entries(mathMap)) {
        const re = new RegExp(`\\b${py}\\s*\\(`, "g");
        expr = expr.replace(re, `${gr}(`);
    }    

    while (i < expr.length) {
        if (expr[i] === "/" && expr[i + 1] === "/" && !isInsideString(expr, i)) {
            out += `<span class="func">div</span>`;
            i += 2;
            continue;
        }
        if (expr[i] === "%" && !isInsideString(expr, i)) {
            out += `<span class="func">mod</span>`;
            i++;
            continue;
        }
        if (expr.substring(i, i + 4) === "True" && !isInsideString(expr, i) && isWordBoundary(expr, i, 4)) {
            out += `<span class="func">ΑΛΗΘΗΣ</span>`;
            i += 4;
            continue;
        }
        if (expr.substring(i, i + 5) === "False" && !isInsideString(expr, i) && isWordBoundary(expr, i, 5)) {
            out += `<span class="func">ΨΕΥΔΗΣ</span>`;
            i += 5;
            continue;
        }
        if (expr.substring(i, i + 3) === "and" && !isInsideString(expr, i) && isWordBoundary(expr, i, 3)) {
            out += `<span class="func">ΚΑΙ</span>`;
            i += 3;
            continue;
        }
        if (expr.substring(i, i + 2) === "or" && !isInsideString(expr, i) && isWordBoundary(expr, i, 2)) {
            out += `<span class="func">Η</span>`;
            i += 2;
            continue;
        }
        if (expr.substring(i, i + 3) === "not" && !isInsideString(expr, i) && isWordBoundary(expr, i, 3)) {
            out += `<span class="func">ΟΧΙ</span>`;
            i += 3;
            continue;
        }

        out += expr[i++];
    }

    return highlightLiterals(out).replace(/\s+/g, ' ').trim();
}

function isWordBoundary(text, startIndex, length) {
    const charBefore = startIndex > 0 ? text[startIndex - 1] : ' ';
    const charAfter = startIndex + length < text.length ? text[startIndex + length] : ' ';
    const isWordChar = /\w/;
    return !isWordChar.test(charBefore) && !isWordChar.test(charAfter);
}

function highlightLiterals(expr) {
    let result = "";
    let i = 0;

    while (i < expr.length) {
        if (expr[i] === "<") {
            let j = i;
            while (j < expr.length && expr[j] !== ">") {
                j++;
            }
            result += expr.substring(i, j + 1);
            i = j + 1;
            continue;
        }

        // strings
        if ((expr[i] === '"' || expr[i] === "'") && (i === 0 || expr[i - 1] !== "&")) {
            const quote = expr[i];
            let j = i + 1;
            let literal = quote;

            while (j < expr.length) {
                if (expr[j] === quote && expr[j - 1] !== "\\") {
                    literal += expr.substring(i + 1, j + 1);
                    result += `<span class="str">${literal}</span>`;
                    i = j + 1;
                    break;
                }
                j++;
            }
            if (j === expr.length) {
                result += expr[i++];
            }
            continue;
        }

        // numbers
        if (/\d/.test(expr[i]) && (i === 0 || !/\w/.test(expr[i - 1]))) {
            let j = i;
            while (j < expr.length && (/\d/.test(expr[j]) || expr[j] === ".")) {
                j++;
            }
            result += `<span class="int">${expr.substring(i, j)}</span>`;
            i = j;
            continue;
        }

        result += expr[i++];
    }

    return result;
}

export function isInsideString(text, index) {
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < index; i++) {
        const c = text[i];
        const prev = text[i - 1];

        if (c === "'" && !inDouble && prev !== "\\") {
            inSingle = !inSingle;
        } 
        else if (c === '"' && !inSingle && prev !== "\\") {
            inDouble = !inDouble;
        }
    }

    return inSingle || inDouble;
}