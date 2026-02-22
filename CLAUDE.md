# Dibujos Dominicales - Parroquia San Benito de Murcia

Aplicación web estática para visualizar y colorear los dibujos de las lecturas dominicales y oraciones. Desplegada en Netlify desde este repositorio.

## Estructura del proyecto

```
dibujos-parroquiales-web/
├── index.html
├── css/styles.css
├── js/app.js
├── extract_images.py      # Script (se ejecuta desde el directorio padre)
├── data/
│   ├── lecturas.json      # Metadatos de todos los domingos
│   └── oraciones.json     # Metadatos de las oraciones
└── public/images/
    ├── YYYY-MM-DD/        # Imágenes de cada domingo
    │   ├── lectura1.png
    │   ├── salmo.png
    │   ├── lectura2.png
    │   └── evangelio.png
    └── oraciones/
        └── {id}/          # Imágenes de cada oración
            ├── imagen1.png
            └── ...
```

## Flujo para añadir nuevos dibujos dominicales

1. Colocar el nuevo `.docx` en el directorio padre (`Dibujos parroquiales/`)
2. Desde `dibujos-parroquiales-web/`, ejecutar:
   ```bash
   python extract_images.py
   ```
3. El script extrae imágenes y regenera `data/lecturas.json`
4. Verificar que las carpetas nuevas en `public/images/` tienen 4 imágenes
5. Commit y push

**Caso especial — archivos duplicados de una misma fecha:**
El script toma el primero alfabéticamente. Si el archivo principal (con 4 lecturas) no es el primero, hay que extraer manualmente del archivo correcto. Ver CLAUDE.md en el directorio padre para el snippet de corrección.

## Flujo para añadir una nueva oración

1. Tener el `.docx` de la oración en el directorio padre
2. Extraer imágenes manualmente (saltar la última, que es el logo):
   ```python
   import zipfile, re, shutil
   from pathlib import Path

   docx = Path("C:/.../Nombre Oración.docx")
   out  = Path("public/images/oraciones/nuevo-id")
   out.mkdir(parents=True)

   with zipfile.ZipFile(docx) as z:
       imgs = sorted([f for f in z.namelist()
                      if f.startswith("word/media/image") and f.endswith(".png")],
                     key=lambda x: int(re.search(r"image(\d+)", x).group(1)))[:-1]
       for i, img in enumerate(imgs):
           with z.open(img) as src, open(out / f"imagen{i+1}.png", "wb") as dst:
               dst.write(src.read())
   ```
3. Añadir entrada en `data/oraciones.json`:
   ```json
   { "id": "nuevo-id", "title": "Nombre visible", "images": ["imagen1", "imagen2", ...] }
   ```

## Estructura de la app

- **Tabs superiores:** `[Oraciones]` + un tab por año — generados dinámicamente
- **Al cargar:** muestra el año más reciente con la fecha más reciente ya seleccionada
- **Domingos:** dropdown filtrado por año + botones Primera Lectura / Salmo / Segunda Lectura / Evangelio
- **Oraciones:** lista de botones de oración + navegación ← / → entre páginas

## Estado actual del contenido

| Sección | Rango | Estado |
|---------|-------|--------|
| Domingos | Oct 2023 – Abr 2024 (Ciclo B) | Completo |
| Domingos | Oct 2024 – Abr 2025 (Ciclo C) | Completo |
| Domingos | Sep–Nov 2025 (Ciclo C cont.) | Completo |
| Domingos | Nov 2025 – Feb 2026 (Ciclo A) | Hasta 22/02/2026 |
| Oraciones | Ave María, Padre Nuestro, Padre Nuestro color, Credo, Jesusito | Completo |

**Última actualización:** 22 de febrero de 2026 · 79 domingos · 5 oraciones
