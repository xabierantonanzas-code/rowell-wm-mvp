#!/usr/bin/env python3
"""Regenera la referencia canónica y los fixtures del harness de rentabilidades.

Fuente de verdad: el manual de rentabilidades v1.1 de Edgard (paquete 260619) y
su motor `manual_metrics.py`, corridos sobre la Raw data CM (inmutable).

Salidas:
  - docs/model_reference_2026-06-12.json          (resumen legible por CV)
  - lib/__tests__/fixtures/model-cases.json       (fixtures del harness vitest)

Uso:
  python3 scripts/generate-model-reference.py \
      "docs/260619_input_Edgard/Raw data semanal" \
      "docs/260619_input_Edgard/Claude_outputs"

Notas importantes (PEND-018 / V-012):
  - El `manual_metrics.py` DEL PAQUETE explota en el sub-periodo de inception
    (M-02 -> 743%) porque le falta el stub-MW. El `chainedTwr` del dashboard NO
    explota (boundary inclusivo en t0 ~ stub-MW) y reproduce el TWR del manual.
  - Por eso la fiabilidad y el TWR de la referencia se toman del MANUAL v1.1
    (lista MANUAL_FLAGGED + overrides), no del engine roto. El harness verifica
    que lib/returns.ts reproduce esos valores y marca exactamente esos 9 casos.
"""
import sys, os, glob, json, importlib.util

# Los 9 casos que el manual v1.1 §3.1 marca como TWR no fiable (PEND-018).
MANUAL_FLAGGED = {"M-04", "M-05", "M-10", "M-13", "M-14", "M-15", "M-16", "M-17", "M-18"}
# TWR del manual donde difiere del engine roto (casos con flujos en inception).
MANUAL_TWR_OVERRIDE = {"M-02": 0.3517, "M-07": 0.0698}

def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else "docs/260619_input_Edgard/Raw data semanal"
    eng_dir = sys.argv[2] if len(sys.argv) > 2 else "docs/260619_input_Edgard/Claude_outputs"
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Carpeta plana con todos los Pos/Saldo + Registro_Operaciones (lo que espera el engine).
    flat = "/tmp/_rowell_flatraw"
    os.makedirs(flat, exist_ok=True)
    for f in glob.glob(os.path.join(raw, "CM_Pos", "*.xlsx")) + glob.glob(os.path.join(raw, "CM_Saldo", "*.xlsx")):
        dst = os.path.join(flat, os.path.basename(f))
        if not os.path.exists(dst):
            os.symlink(os.path.abspath(f), dst)
    ro = os.path.join(raw, "CM_Reg_Ops", "Registro_Operaciones.xlsx")
    if os.path.exists(ro) and not os.path.exists(os.path.join(flat, "Registro_Operaciones.xlsx")):
        os.symlink(os.path.abspath(ro), os.path.join(flat, "Registro_Operaciones.xlsx"))

    out = "/tmp/_rowell_ref_out"
    os.makedirs(out, exist_ok=True)
    spec = importlib.util.spec_from_file_location("mm", os.path.join(eng_dir, "manual_metrics.py"))
    mm = importlib.util.module_from_spec(spec)
    sys.argv = ["mm", flat, out]
    spec.loader.exec_module(mm)
    mm.main()

    cases, ref = [], []
    for f in sorted(glob.glob(os.path.join(out, "caso_*.json"))):
        d = json.load(open(f))
        mid = d["id"]
        reliable = mid not in MANUAL_FLAGGED
        twr_cum = MANUAL_TWR_OVERRIDE.get(mid, d.get("twr_cum"))
        cases.append({
            "id": mid, "titulo": d["titulo"], "cv": d["cv"], "t0": d["t0"], "asOf": d["as_of"],
            "snapshots": [{"date": s["fecha"], "vPos": s["vpos"]} for s in d["snapshots"]],
            "flows": [{"amount": round(o["cf"], 2), "date": o["fecha"]} for o in d["ops"] if o["cf"] != 0.0],
            "expected": {
                "ci": round(d["ci"], 2), "vpos": round(d["vpos"], 2),
                "simple": d["simple"], "mwrAnnual": d["mwr_ann"], "mwrCum": d["mwr_cum"],
                "twrCum": twr_cum, "twrAnnual": d["twr_ann"],
                "twrReliable": reliable, "twrReasons": [] if reliable else ["marcado_manual_v1.1_PEND-018"],
            }})
        ref.append({"id": mid, "cv": d["cv"], "titulo": d["titulo"], "t0": d["t0"],
            "ci": round(d["ci"], 2), "vpos": round(d["vpos"], 2),
            "simplePct": round(d["simple"] * 100, 2) if d["simple"] is not None else None,
            "mwrAnnualPct": round(d["mwr_ann"] * 100, 2) if d["mwr_ann"] is not None else None,
            "twrCumPct": round(twr_cum * 100, 2) if twr_cum is not None else None,
            "twrReliable": reliable})

    meta = {"generated": "2026-06-20", "asOf": "2026-06-12",
            "source": "Manual de rentabilidades v1.1 (Edgard, 260619) + manual_metrics.py sobre Raw data CM",
            "criterion": {"subperiodAbsReturn": ">=1.0", "mwrDivergence": ">0.20 (20pp anual)", "twrNull": "no fiable"},
            "note": "TWR/flags del MANUAL v1.1. El chainedTwr del dashboard los reproduce; el engine del paquete explota en inception (le falta stub-MW)."}
    json.dump({"_meta": meta, "cases": cases},
              open(os.path.join(here, "lib/__tests__/fixtures/model-cases.json"), "w"), ensure_ascii=False, indent=1)
    json.dump({"_meta": meta, "cases": ref},
              open(os.path.join(here, "docs/model_reference_2026-06-12.json"), "w"), ensure_ascii=False, indent=1)
    print("OK:", len(cases), "casos. No fiables:", [c["id"] for c in cases if not c["expected"]["twrReliable"]])

if __name__ == "__main__":
    main()
