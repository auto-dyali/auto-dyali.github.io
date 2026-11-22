const fs = require("fs");
let content = fs.readFileSync("src/components/pos/PosMaquette.tsx", "utf8");
let lines = content.split("\n");
// Trouver le bouton "Finaliser" (ligne 518, index 517)
let btnIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('disabled={!peutValider} onClick={valider} className="pos-final-btn min-h-11 shrink-0 rounded-lg px-3 text-xs font-black"')) {
    btnIdx = i;
    break;
  }
}
if (btnIdx === -1) {
  console.log("Bouton non trouvé");
  process.exit(1);
}
// Le bouton occupe 3 lignes : btnIdx, btnIdx+1, btnIdx+2
const btnLines = lines.splice(btnIdx, 3);
// Insérer le bouton juste avant la ligne 517 (index 516), qui est le </div> fermant le div.flex items-center gap-2
lines.splice(516, 0, ...btnLines);
fs.writeFileSync("src/components/pos/PosMaquette.tsx", lines.join("\n"));
console.log("Bouton déplacé à l'intérieur du div.flex items-center gap-2, avant la ligne 517");