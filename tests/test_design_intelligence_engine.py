from pathlib import Path
import json
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "core" / "design-intelligence.js"


def run_engine(expression):
    node = shutil.which("node")
    assert node, "Node.js is required for SVIE runtime tests"
    script = f"const e=require({json.dumps(str(ENGINE))});\n{expression}"
    return subprocess.run([node, "-e", script], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()


def test_semantic_color_choices_are_sparse_and_context_aware():
    result = json.loads(run_engine("""
console.log(JSON.stringify([
 e.resolve({component:'generic',state:'neutral'}),
 e.resolve({component:'timer',state:'pending'}),
 e.resolve({component:'status',state:'success'}),
 e.resolve({component:'control',state:'selected'}),
 e.resolve({component:'decorative-icon',state:'selected'}),
 e.resolve({component:'recording-indicator',state:'recording'})
]));
"""))
    assert [x["tone"] for x in result] == ["neutral", "yellow", "green", "blue", "neutral", "red"]
    assert result[0]["tint"] is False and result[0]["badge"] is False
    assert result[1]["tint"] is False


def test_only_explicitly_opted_in_elements_are_managed():
    result = json.loads(run_engine("""
const untouched={setAttribute(){throw new Error('must not mutate')},hasAttribute(){return false}};
const opted={attrs:{'data-visual-intelligence':'timer','data-state':'pending'},
 hasAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k)},
 getAttribute(k){return this.attrs[k]||null},setAttribute(k,v){this.attrs[k]=v}};
const skipped=e.apply(untouched,{component:'button',state:'error'});
const applied=e.apply(opted,{component:'timer'});
console.log(JSON.stringify({skipped:skipped,applied:applied.tone,attrs:opted.attrs}));
"""))
    assert result["skipped"] is False
    assert result["applied"] == "yellow"
    assert result["attrs"]["data-svie-tone"] == "yellow"


def test_runtime_is_integrated_through_pages_asset_preparation():
    engine = ENGINE.read_text(encoding="utf-8")
    prep = (ROOT / "scripts" / "prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    css = (ROOT / "core" / "design-intelligence.css").read_text(encoding="utf-8")
    assert "root.MosharrofVisualIntelligence = api" in engine
    assert "core/design-intelligence.js" in prep
    assert "design-intelligence.css" in prep
    assert all(color in css for color in ("#DC2626", "#2563EB", "#16A34A", "#EAB308"))
    assert 'querySelectorAll(".response-timer,.voice-companion,.message-speak-shortcut,.message-action")' in engine
