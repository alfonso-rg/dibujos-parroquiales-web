#!/usr/bin/env python3
"""
Script para extraer imágenes y textos de los archivos Word de lecturas parroquiales.
Genera estructura de carpetas por fecha y un archivo JSON con metadatos.
"""

import os
import re
import json
import zipfile
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime

# Configuración
SOURCE_DIR = Path(__file__).parent.parent  # Carpeta padre (Dibujos parroquiales)
OUTPUT_DIR = Path(__file__).parent / "public" / "images"
DATA_DIR = Path(__file__).parent / "data"

# Nombres de las lecturas en orden
LECTURA_NAMES = ["lectura1", "salmo", "lectura2", "evangelio"]

# Patrones para identificar los headings de cada lectura
HEADING_PATTERNS = [
    (r'primera\s+lectura', 'lectura1'),
    (r'salmo', 'salmo'),
    (r'segunda\s+lectura', 'lectura2'),
    (r'evangelio', 'evangelio'),
]

# Namespace XML de Word
WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def extract_date_from_filename(filename):
    """Extrae la fecha YYYY-MM-DD del nombre del archivo."""
    match = re.search(r'(\d{4}-\d{2}-\d{2})', filename)
    if match:
        return match.group(1)
    return None


def extract_description_from_filename(filename):
    """Extrae la descripción del día del nombre del archivo."""
    name = filename.replace('.docx', '').replace('Lecturas ', '')
    name = re.sub(r'\d{4}-\d{2}-\d{2}\s*', '', name)
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
            media_files = [f for f in zip_ref.namelist()
                          if f.startswith('word/media/image') and f.endswith('.png')]
            media_files.sort(key=lambda x: int(re.search(r'image(\d+)', x).group(1)))
            main_images = media_files[:4]

            if len(main_images) < 4:
                print(f"  AVISO: Solo se encontraron {len(main_images)} imágenes en {docx_path.name}")

            output_folder.mkdir(parents=True, exist_ok=True)

            for i, media_file in enumerate(main_images):
                if i < len(LECTURA_NAMES):
                    new_name = f"{LECTURA_NAMES[i]}.png"
                    output_path = output_folder / new_name
                    with zip_ref.open(media_file) as source:
                        with open(output_path, 'wb') as target:
                            target.write(source.read())
                    images_extracted.append(LECTURA_NAMES[i])

    except Exception as e:
        print(f"  ERROR procesando {docx_path.name}: {e}")

    return images_extracted


def extract_texts_from_docx(docx_path):
    """
    Extrae las citas bíblicas y frases instructivas de cada lectura del .docx.
    Devuelve un dict: {"lectura1": {"cita": "...", "frase": "..."}, ...}

    Maneja dos patrones de estructura:
      Patrón A (archivos antiguos): heading -> frase (párrafo aparte) -> imagen
      Patrón B (archivos nuevos):   heading -> imagen+frase (mismo párrafo)
    """
    readings = {}

    try:
        with zipfile.ZipFile(docx_path, 'r') as z:
            with z.open('word/document.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()

                # Extraer párrafos con su texto y si tienen imagen
                paragraphs = []
                for p in root.findall(f'.//{{{W_NS}}}p'):
                    text = re.sub(r'[ ​-‏ - ﻿]', ' ', ''.join(
                        t.text or ''
                        for t in p.findall(f'.//{{{W_NS}}}t')
                    )).strip()
                    has_image = bool(
                        p.findall(f'.//{{{WP_NS}}}inline') or
                        p.findall(f'.//{{{WP_NS}}}anchor')
                    )
                    paragraphs.append((text, has_image))

                # Recorrer párrafos buscando headings de lectura
                i = 0
                while i < len(paragraphs):
                    text, has_image = paragraphs[i]
                    if not text:
                        i += 1
                        continue

                    # Intentar matchear un heading de lectura
                    lectura_key = None
                    for pattern, key in HEADING_PATTERNS:
                        if re.search(pattern, text, re.IGNORECASE):
                            lectura_key = key
                            break

                    if lectura_key is None:
                        i += 1
                        continue

                    # Extraer cita bíblica de los paréntesis
                    cita_match = re.search(r'\((.+?)\)', text)
                    cita = cita_match.group(1) if cita_match else ''

                    # Buscar la frase instructiva en los siguientes párrafos
                    frase = ''
                    j = i + 1
                    while j < len(paragraphs):
                        next_text, next_has_image = paragraphs[j]
                        if next_text:
                            # Verificar que no es otro heading
                            is_heading = any(
                                re.search(p, next_text, re.IGNORECASE)
                                for p, _ in HEADING_PATTERNS
                            )
                            if not is_heading:
                                frase = next_text
                                break
                        j += 1

                    readings[lectura_key] = {
                        'cita': cita,
                        'frase': frase
                    }

                    i += 1

    except Exception as e:
        print(f"  ERROR extrayendo textos de {docx_path.name}: {e}")

    return readings


def main():
    print("=" * 60)
    print("Extracción de imágenes y textos de archivos Word")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    docx_files = list(SOURCE_DIR.glob("Lecturas *.docx"))
    print(f"\nEncontrados {len(docx_files)} archivos Word de lecturas")

    lecturas_data = []
    processed_dates = set()

    for docx_file in sorted(docx_files):
        date = extract_date_from_filename(docx_file.name)

        if not date:
            print(f"  SALTANDO (sin fecha): {docx_file.name}")
            continue

        if date in processed_dates:
            print(f"  SALTANDO (fecha duplicada): {docx_file.name}")
            continue

        description = extract_description_from_filename(docx_file.name)
        output_folder = OUTPUT_DIR / date

        print(f"\nProcesando: {docx_file.name}")
        print(f"  Fecha: {date}")
        print(f"  Descripción: {description}")

        images = extract_images_from_docx(docx_file, output_folder)
        readings = extract_texts_from_docx(docx_file)

        if images:
            processed_dates.add(date)

            date_obj = datetime.strptime(date, "%Y-%m-%d")
            date_display = date_obj.strftime("%d/%m/%Y")

            entry = {
                "date": date,
                "dateDisplay": date_display,
                "description": description,
                "images": images
            }

            if readings:
                entry["readings"] = readings

            lecturas_data.append(entry)

            print(f"  Imágenes extraídas: {', '.join(images)}")
            if readings:
                for key, val in readings.items():
                    print(f"  {key}: ({val['cita']}) {val['frase'][:60]}")

    lecturas_data.sort(key=lambda x: x["date"])

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
