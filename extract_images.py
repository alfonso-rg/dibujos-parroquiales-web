#!/usr/bin/env python3
"""
Script para extraer imágenes de los archivos Word de lecturas parroquiales.
Genera estructura de carpetas por fecha y un archivo JSON con metadatos.
"""

import os
import re
import json
import zipfile
import shutil
from pathlib import Path
from datetime import datetime

# Configuración
SOURCE_DIR = Path(__file__).parent.parent  # Carpeta padre (Dibujos parroquiales)
OUTPUT_DIR = Path(__file__).parent / "public" / "images"
DATA_DIR = Path(__file__).parent / "data"

# Nombres de las lecturas en orden
LECTURA_NAMES = ["lectura1", "salmo", "lectura2", "evangelio"]

def extract_date_from_filename(filename):
    """Extrae la fecha YYYY-MM-DD del nombre del archivo."""
    match = re.search(r'(\d{4}-\d{2}-\d{2})', filename)
    if match:
        return match.group(1)
    return None

def extract_description_from_filename(filename):
    """Extrae la descripción del día del nombre del archivo."""
    # Patrón: Lecturas YYYY-MM-DD [Día de la semana] [Descripción] Ciclo [A/B/C].docx
    # Ejemplo: Lecturas 2023-10-08 Domingo D XVII TO Ciclo A.docx

    # Eliminar extensión y prefijo "Lecturas"
    name = filename.replace('.docx', '').replace('Lecturas ', '')

    # Eliminar la fecha
    name = re.sub(r'\d{4}-\d{2}-\d{2}\s*', '', name)

    # Eliminar sufijos como "Ciclo A/B/C", "_4o", "bis", "GRANDE", "Pedro"
    name = re.sub(r'\s*Ciclo\s*[ABC].*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'_4o$', '', name)
    name = re.sub(r'\s+bis$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+GRANDE$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+Pedro$', '', name, flags=re.IGNORECASE)

    return name.strip()

def extract_images_from_docx(docx_path, output_folder):
    """
    Extrae las 4 imágenes principales de un archivo .docx.
    Los .docx son archivos ZIP, las imágenes están en word/media/.
    """
    images_extracted = []

    try:
        with zipfile.ZipFile(docx_path, 'r') as zip_ref:
            # Listar archivos de imagen en word/media/
            media_files = [f for f in zip_ref.namelist()
                          if f.startswith('word/media/image') and f.endswith('.png')]

            # Ordenar por número de imagen
            media_files.sort(key=lambda x: int(re.search(r'image(\d+)', x).group(1)))

            # Tomar solo las primeras 4 imágenes (ignorar image5 que es el logo)
            main_images = media_files[:4]

            if len(main_images) < 4:
                print(f"  AVISO: Solo se encontraron {len(main_images)} imágenes en {docx_path.name}")

            # Crear carpeta de salida
            output_folder.mkdir(parents=True, exist_ok=True)

            # Extraer y renombrar cada imagen
            for i, media_file in enumerate(main_images):
                if i < len(LECTURA_NAMES):
                    new_name = f"{LECTURA_NAMES[i]}.png"
                    output_path = output_folder / new_name

                    # Extraer imagen
                    with zip_ref.open(media_file) as source:
                        with open(output_path, 'wb') as target:
                            target.write(source.read())

                    images_extracted.append(LECTURA_NAMES[i])

    except Exception as e:
        print(f"  ERROR procesando {docx_path.name}: {e}")

    return images_extracted

def main():
    print("=" * 60)
    print("Extracción de imágenes de archivos Word")
    print("=" * 60)

    # Crear directorios de salida
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Buscar todos los archivos .docx de lecturas
    docx_files = list(SOURCE_DIR.glob("Lecturas *.docx"))

    print(f"\nEncontrados {len(docx_files)} archivos Word de lecturas")

    # Estructura para el JSON
    lecturas_data = []

    # Procesar cada archivo
    processed_dates = set()

    for docx_file in sorted(docx_files):
        date = extract_date_from_filename(docx_file.name)

        if not date:
            print(f"  SALTANDO (sin fecha): {docx_file.name}")
            continue

        # Si ya procesamos esta fecha, saltar (puede haber duplicados como "bis")
        if date in processed_dates:
            print(f"  SALTANDO (fecha duplicada): {docx_file.name}")
            continue

        description = extract_description_from_filename(docx_file.name)
        output_folder = OUTPUT_DIR / date

        print(f"\nProcesando: {docx_file.name}")
        print(f"  Fecha: {date}")
        print(f"  Descripción: {description}")

        images = extract_images_from_docx(docx_file, output_folder)

        if images:
            processed_dates.add(date)

            # Formatear fecha para mostrar
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            date_display = date_obj.strftime("%d/%m/%Y")

            lecturas_data.append({
                "date": date,
                "dateDisplay": date_display,
                "description": description,
                "images": images
            })

            print(f"  Imágenes extraídas: {', '.join(images)}")

    # Ordenar por fecha
    lecturas_data.sort(key=lambda x: x["date"])

    # Guardar JSON
    json_path = DATA_DIR / "lecturas.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(lecturas_data, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"COMPLETADO")
    print(f"  Total de fechas procesadas: {len(lecturas_data)}")
    print(f"  JSON guardado en: {json_path}")
    print(f"  Imágenes guardadas en: {OUTPUT_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
