#!/bin/bash

# ============================================================
# extract_code.sh
# Genera:
#   - _structure.txt : árbol de directorios del proyecto
#   - _fullCode.txt  : todo el código separado por archivo
# Excluye: node_modules, dist, .git, y archivos binarios
# ============================================================

set -e

# --- Configuración -------------------------------------------------
# Directorio raíz a analizar ('.' = todo el proyecto)
SRC_PATH="."

STRUCTURE_FILE="_structure.txt"
FULLCODE_FILE="_fullCode.txt"
SEPARATOR="________"

# Directorios a excluir
EXCLUDE_DIRS=(
  "node_modules"
  "dist"
  "build"
  ".git"
  ".next"
  ".nuxt"
  "coverage"
  ".cache"
  "out"
)

# Extensiones/archivos a ignorar (binarios, imágenes, etc.)
EXCLUDE_PATTERNS=(
  "*.png" "*.jpg" "*.jpeg" "*.gif" "*.bmp" "*.ico" "*.svg"
  "*.pdf" "*.zip" "*.tar" "*.gz" "*.rar" "*.7z"
  "*.exe" "*.dll" "*.so" "*.dylib" "*.bin" "*.class" "*.o"
  "*.mp3" "*.mp4" "*.mov" "*.avi" "*.wav"
  "*.lock" ".env"
  # Archivos generados por este mismo script
  "_structure.txt" "_fullCode.txt"
)

# --- 1. Construir expresión de exclusión para find ----------------
EXCLUDE_EXPR=()

# Excluir directorios
for dir in "${EXCLUDE_DIRS[@]}"; do
    EXCLUDE_EXPR+=( -not -path "*/$dir/*" -not -path "./$dir" )
done

# Excluir patrones de archivos
for pat in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_EXPR+=( -not -name "$pat" )
done

echo "🔍 Analizando proyecto desde: $SRC_PATH"
echo "🚫 Excluyendo: ${EXCLUDE_DIRS[*]}"
echo ""

# --- 2. Generar _structure.txt con 'tree' -------------------------
echo "🌳 Generando $STRUCTURE_FILE..."

if command -v tree &> /dev/null; then
    # Construir -I para tree (patrón de exclusión de directorios)
    TREE_EXCLUDE=$(IFS='|'; echo "${EXCLUDE_DIRS[*]}")
    tree -I "$TREE_EXCLUDE" -a --dirsfirst "$SRC_PATH" > "$STRUCTURE_FILE"
else
    # Fallback si no hay 'tree' instalado
    find "$SRC_PATH" "${EXCLUDE_EXPR[@]}" \
        | sed -e "s/[^-][^\/]*\// |/g" -e "s/|\([^ ]\)/|-\1/" \
        > "$STRUCTURE_FILE"
    echo "⚠️  'tree' no instalado, se usó 'find' como fallback."
fi
echo "✅ $STRUCTURE_FILE creado."

# --- 3. Generar _fullCode.txt --------------------------------------
echo "📝 Generando $FULLCODE_FILE..."
> "$FULLCODE_FILE"   # Limpiar/crear archivo

# Recorrer archivos ordenados
find "$SRC_PATH" -type f "${EXCLUDE_EXPR[@]}" | sort | while read -r file; do
    # Ruta relativa al directorio actual
    rel_path="${file#./}"

    {
        echo "$rel_path"
        echo ""
        cat "$file"
        echo ""
        echo "$SEPARATOR"
        echo ""
    } >> "$FULLCODE_FILE"
done

echo "✅ $FULLCODE_FILE creado."
echo ""
echo "🎉 Listo. Archivos generados:"
echo "   - $STRUCTURE_FILE"
echo "   - $FULLCODE_FILE"	
