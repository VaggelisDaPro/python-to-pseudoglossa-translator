import { getAlgName, analyze, analyzeAst } from "./analyzer.js";
import { parse } from "./parser.js";
import { emit as emitPseudoglossa } from "./langs/pseudoglossa.js";
import { emit, emit as emitGlossa } from "./langs/glossa.js";
let currentOutputMode = "glossa";
let uiLanguage = localStorage.getItem("uiLanguage") || "en";

const inputEl = document.getElementById("input");
const outputEl = document.querySelector(".output-area");
const convertBtn = document.querySelector(".convert-btn");
const copyBtn = document.getElementById("copy-btn");
const saveBtn = document.getElementById("save-btn");
const modeButtons = document.querySelectorAll(".output-mode-btn");
const uiLangBtn = document.getElementById("uiLanguageBtn");
const pythonConsole = document.getElementById("pythonErrorConsole");
const translationConsole = document.getElementById("translationErrorConsole");

const translations = {
    en: {
        title: 'Code Translator',
        description: 'Convert Python code to Glossa or Pseudoglossa.',
        pythonInput: 'Python Input',
        output: 'Output',
        glossa: 'Γλώσσα',
        pseudoglossa: 'Ψευδογλώσσα',
        copy: 'Copy',
        copied: 'Copied!',
        save: 'Save',
    },
    el: {
        title: 'Μεταφραστής Python',
        description: 'Μετατρέψτε τον κώδικα Python σε Γλώσσα ή Ψευδογλώσσα.',
        pythonInput: 'Είσοδος Python',
        output: 'Έξοδος',
        glossa: 'Γλώσσα',
        pseudoglossa: 'Ψευδογλώσσα',
        copy: 'Αντιγραφή',
        copied: 'Αντιγράφηκε!',
        save: 'Αποθήκευση',
    }
};

function updateUITexts() {
    const t = translations[uiLanguage];
    document.querySelector('.header h1').textContent = t.title;
    document.querySelector('.header p').textContent = t.description;
    document.getElementById('input-label').textContent = t.pythonInput;
    document.getElementById('output-label').textContent = t.output;
    document.querySelectorAll('.output-mode-btn')[0].textContent = t.glossa;
    document.querySelectorAll('.output-mode-btn')[1].textContent = t.pseudoglossa;
    copyBtn.innerHTML = `<i class='bx bx-copy'></i> ${t.copy}`;
    uiLangBtn.innerHTML = `<i class='bx bx-translate'></i> ${uiLanguage.toUpperCase()}`;
    saveBtn.innerHTML = `<i class='bx  bx-save'></i>  ${t.save}`;
}

function clearPythonConsole() {
    pythonConsole.textContent = "";
};
function clearTranslationConsole() {
    translationConsole.textContent = "";
}

function showPythonError(message) {
    pythonConsole.textContent = message;
}
function showTranslationError(message) {
    translationConsole.textContent = message;
}
  
modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        modeButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentOutputMode = btn.dataset.mode;
        outputEl.innerText = ""; 
        clearTranslationConsole();
    });
});

convertBtn.addEventListener("click", () => {
    clearPythonConsole();
    clearTranslationConsole();
    const source = inputEl.value;
    let algName = "";

    try {
        algName = getAlgName(source.split("\n"), currentOutputMode);
    } catch (e) {
        showTranslationError(e.message);
        return;
    }

    try {
        const analysis = analyze(source.split("\n"));
        const ast = parse(source.split("\n"));
        const renamedAst = analyzeAst(ast, algName);

        if (currentOutputMode === "glossa") {
            const functions = renamedAst.filter(node => node.type === "function");
            const mainAst = renamedAst.filter(node => node.type !== "function");
            let code = `<span class="func">ΠΡΟΓΡΑΜΜΑ</span> ${algName}\n`;
            code += emitGlossa(mainAst, analysis?.variables || {}, 1, true);
            code += `<span class="func">ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ</span>\n\n`;
            for (const func of functions) {
                code += emitGlossa([func], func.variables || null, 0, false) + "\n";
            }
            outputEl.innerHTML = code;
        } else {
            const code = emitPseudoglossa(renamedAst);
            outputEl.innerHTML = `<span class="func">ΑΛΓΟΡΙΘΜΟΣ</span> ${algName}\n${code}<span class="func">ΤΕΛΟΣ</span> ${algName}`;
        }
    } catch (e) {
        showTranslationError(e.message);
    }
});



copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(outputEl.innerText).then(() => {
        copyBtn.innerHTML = `<i class='bx  bx-check'></i> ${translations[uiLanguage].copied}`;
        setTimeout(() => {
        copyBtn.innerHTML = `<i class='bx  bx-copy'></i> ${translations[uiLanguage].copy}`;
        }, 2000);
    });
});

saveBtn.addEventListener("click", () => {
    const blob = new Blob([outputEl.innerText], { type: "text/plain;charset=utf-8" });
    const algName = getAlgName(inputEl.value.split("\n"), currentOutputMode).toLowerCase();
    const filename = currentOutputMode === "glossa" ? `${algName}.glo` : `${algName}.ps`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

uiLangBtn.addEventListener("click", () => {
    uiLanguage = uiLanguage === "en" ? "el" : "en";
    localStorage.setItem("uiLanguage", uiLanguage);

    updateUITexts();
});
updateUITexts();