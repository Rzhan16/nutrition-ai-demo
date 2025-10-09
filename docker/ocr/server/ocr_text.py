import json
import os
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from paddleocr import PaddleOCR

from .postprocess import apply_post_corrections

CACHE_DIR = os.getenv("OCR_CACHE_DIR", "/app/server/cache")
os.makedirs(CACHE_DIR, exist_ok=True)

DEBUG_OVERLAY = os.getenv("OCR_DEBUG_OVERLAY", "false").lower() == "true"
OVERLAY_DIR = os.path.join(CACHE_DIR, "overlay")
if DEBUG_OVERLAY:
    os.makedirs(OVERLAY_DIR, exist_ok=True)

MAX_IMAGE_SIDE = int(os.getenv("OCR_MAX_SIDE", "1600"))
USE_CLAHE = os.getenv("OCR_USE_CLAHE", "true").lower() == "true"
USE_SHARPEN = os.getenv("OCR_USE_SHARPEN", "true").lower() == "true"
CONFIDENCE_MIN = float(os.getenv("OCR_CONFIDENCE_MIN", "0.80"))
LOW_CONFIDENCE_MIN = float(os.getenv("OCR_LOW_CONF_MIN", "0.55"))
LOW_CONFIDENCE_LEN_MIN = int(os.getenv("OCR_LOW_CONF_LEN_MIN", "3"))
USE_DENOISE = os.getenv("OCR_DENOISE", "false").lower() == "true"
POST_CORRECT = os.getenv("OCR_POST_CORRECT", "true").lower() == "true"

ROI_ENABLED = os.getenv("OCR_USE_BRAND_ROI", "true").lower() == "true"
ROI_TOP_RATIO = float(os.getenv("OCR_ROI_TOP_RATIO", "0.55"))
ROI_SCALE = float(os.getenv("OCR_ROI_SCALE", "1.6"))
ROI_MAX = int(os.getenv("OCR_ROI_MAX", "2"))

BRAND_TRIGRAM_THRESHOLD = float(os.getenv("OCR_BRAND_TRIGRAM_THRESHOLD", "0.7"))
BRAND_LIST_PATH = os.getenv("OCR_BRAND_LIST_PATH", "/app/brands.json")
BRAND_EQUIV_PATH = os.getenv(
    "OCR_EQUIVALENTS_PATH",
    "/app/webapp/scripts/data/equivalents.json",
)

LOW_CONF_STOPWORDS = {
    "facts",
    "supplementfacts",
    "supplement",
    "nutritionfacts",
    "nutritionalfacts",
    "dietarysupplement",
    "servingsize",
    "servingpercontainer",
    "nongmo",
    "glutenfree",
    "glutenfreenongmo",
    "otheringredients",
    "ingredients",
    "warning",
    "warnings",
    "directions",
}


def init_ocr() -> PaddleOCR:
    return PaddleOCR(
        use_angle_cls=os.getenv("OCR_USE_ANGLE_CLS", "true").lower() == "true",
        lang=os.getenv("OCR_LANG", "en"),
        use_gpu=False,
        cpu_threads=4,
    )


def _decode_image(img_bytes: bytes) -> np.ndarray:
    array = np.frombuffer(img_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode image bytes")
    return image


def _preprocess_image(image: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
    start = time.time()
    original_shape = image.shape[:2]
    height, width = original_shape
    max_side = max(height, width)

    if max_side > MAX_IMAGE_SIDE:
        scale = MAX_IMAGE_SIDE / max_side
        new_size = (int(width * scale), int(height * scale))
        image = cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    if USE_CLAHE:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
    else:
        gray = cv2.equalizeHist(gray)

    if USE_SHARPEN:
        blurred = cv2.GaussianBlur(gray, (0, 0), 1.0)
        gray = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)

    image = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    if USE_DENOISE:
        image = cv2.fastNlMeansDenoisingColored(image, None, 5, 5, 7, 21)

    preprocess_ms = int((time.time() - start) * 1000)
    meta = {
        "original_shape": original_shape,
        "processed_shape": image.shape[:2],
        "preprocess_ms": preprocess_ms,
    }
    return image, meta


def _cache_path(digest: str) -> str:
    return os.path.join(CACHE_DIR, f"{digest}.json")


def _load_cache(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    data["cached"] = True
    data.setdefault("corrected_count", 0)
    return data


def _store_cache(path: str, payload: Dict[str, Any]) -> None:
    to_store = dict(payload)
    to_store["cached"] = False
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(to_store, handle, ensure_ascii=False)


def _normalize_token(text: str) -> str:
    return "".join(ch for ch in text.lower() if ch.isalnum())


def _trigram_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if len(a) < 3 or len(b) < 3:
        return 1.0 if a == b else 0.0
    tri_a = {a[i : i + 3] for i in range(len(a) - 2)}
    tri_b = {b[i : i + 3] for i in range(len(b) - 2)}
    intersection = len(tri_a & tri_b)
    union = len(tri_a | tri_b)
    if union == 0:
        return 0.0
    return intersection / union


def _load_brand_data() -> Tuple[Dict[str, str], Dict[str, str]]:
    alias_map: Dict[str, str] = {}
    canonical_norm: Dict[str, str] = {}

    def _register_brand(name: str) -> None:
        cleaned = name.strip()
        if not cleaned:
            return
        normalized = _normalize_token(cleaned)
        if not normalized:
            return
        canonical_norm[cleaned] = normalized
        alias_map.setdefault(normalized, cleaned)

    try:
        with open(BRAND_LIST_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
            brands = data.get("brands")
            if isinstance(brands, list):
                for name in brands[:200]:
                    if isinstance(name, str):
                        _register_brand(name)
    except Exception as error:  # noqa: BLE001
        print(f"[OCR] Warning: unable to load brand list from {BRAND_LIST_PATH}: {error}")

    try:
        with open(BRAND_EQUIV_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
            if isinstance(data, list):
                for entry in data:
                    canonical = entry.get("canonical") if isinstance(entry, dict) else None
                    if not isinstance(canonical, str):
                        continue
                    _register_brand(canonical)
                    aliases = entry.get("aliases") if isinstance(entry, dict) else None
                    if isinstance(aliases, list):
                        for alias in aliases:
                            if isinstance(alias, str):
                                normalized_alias = _normalize_token(alias)
                                if normalized_alias:
                                    alias_map[normalized_alias] = canonical
    except Exception as error:  # noqa: BLE001
        print(f"[OCR] Warning: unable to load brand equivalents from {BRAND_EQUIV_PATH}: {error}")

    return alias_map, canonical_norm


BRAND_ALIAS_MAP, CANONICAL_NORMALIZED = _load_brand_data()
CANONICAL_LIST = list(CANONICAL_NORMALIZED.items())


def _canonicalize_brand_token(token: str) -> Optional[str]:
    normalized = _normalize_token(token)
    if not normalized or len(normalized) < 3:
        return None

    if normalized in BRAND_ALIAS_MAP:
        return BRAND_ALIAS_MAP[normalized]

    best_score = 0.0
    best_match: Optional[str] = None
    for canonical, canonical_norm in CANONICAL_LIST:
        score = _trigram_similarity(normalized, canonical_norm)
        if score > best_score:
            best_score = score
            best_match = canonical

    if best_match and best_score >= BRAND_TRIGRAM_THRESHOLD:
        return best_match
    return None


def _build_joined_text(words: List[Dict[str, Any]]) -> Tuple[List[str], str]:
    grouped: Dict[int, List[str]] = defaultdict(list)
    for word in words:
        line_id = int(word.get("line_id", 0))
        grouped[line_id].append(str(word.get("text", "")))
    lines: List[str] = []
    for line_id in sorted(grouped.keys()):
        joined = " ".join(token for token in grouped[line_id] if token)
        if joined:
            lines.append(joined)
    return lines, "\n".join(lines)


def _recognize_pass(
    ocr: PaddleOCR,
    image: np.ndarray,
    pass_name: str,
    bbox_offset: Tuple[int, int] = (0, 0),
) -> Dict[str, Any]:
    start = time.time()
    raw_result = ocr.ocr(image)
    elapsed_ms = int((time.time() - start) * 1000)

    lines = raw_result[0] if raw_result else []
    words: List[Dict[str, Any]] = []
    filtered_count = 0
    fallback_kept = 0
    low_conf_debug: List[Tuple[str, float]] = []
    line_boxes: List[Dict[str, Any]] = []

    offset_x, offset_y = bbox_offset

    for line_id, line in enumerate(lines):
        text, confidence = line[1][0], float(line[1][1])
        normalized = _normalize_token(text)

        if confidence < CONFIDENCE_MIN:
            if normalized in LOW_CONF_STOPWORDS:
                filtered_count += 1
                continue
            low_conf_debug.append((text, confidence))
            alnum_len = len([ch for ch in text if ch.isalnum()])
            if confidence < LOW_CONFIDENCE_MIN or alnum_len < LOW_CONFIDENCE_LEN_MIN:
                filtered_count += 1
                continue
            fallback_kept += 1

        flat_bbox = [int(coord) for point in line[0] for coord in point]
        xs = flat_bbox[0::2]
        ys = flat_bbox[1::2]
        x_min = max(0, min(xs) + offset_x)
        x_max = max(0, max(xs) + offset_x)
        y_min = max(0, min(ys) + offset_y)
        y_max = max(0, max(ys) + offset_y)
        line_boxes.append(
            {
                "line_id": line_id,
                "bbox": flat_bbox,
                "rect": (x_min, y_min, x_max, y_max),
                "height": y_max - y_min,
            }
        )

        adjusted_bbox = []
        for idx, coord in enumerate(flat_bbox):
            if idx % 2 == 0:
                adjusted_bbox.append(coord + offset_x)
            else:
                adjusted_bbox.append(coord + offset_y)

        words.append(
            {
                "text": text,
                "confidence": confidence,
                "bbox": adjusted_bbox,
                "line_id": line_id,
                "block_id": 0,
            }
        )

    corrected_count = 0
    if POST_CORRECT and words:
        corrected_count, words, _ = apply_post_corrections(
            words, "\n".join(word["text"] for word in words)
        )

    brand_hits: List[str] = []
    for word in words:
        text = str(word.get("text", ""))
        if not text:
            continue
        letters = sum(ch.isalpha() for ch in text)
        if letters < 3:
            continue
        if letters / max(1, len(text)) < 0.5:
            continue
        canonical = _canonicalize_brand_token(text)
        if canonical:
            if canonical != text:
                word.setdefault("raw_text", text)
                word["text"] = canonical
            brand_hits.append(canonical)

    text_lines, joined_text = _build_joined_text(words)

    return {
        "pass": pass_name,
        "words": words,
        "text_lines": text_lines,
        "joined_text": joined_text,
        "filtered": filtered_count,
        "fallback": fallback_kept,
        "elapsed_ms": elapsed_ms,
        "corrected_count": corrected_count,
        "low_conf_samples": low_conf_debug[:5],
        "brand_hits": brand_hits,
        "line_boxes": line_boxes,
    }


def _generate_roi_candidates(
    image: np.ndarray, line_boxes: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    if ROI_MAX <= 0:
        return []

    height, width = image.shape[:2]
    candidates: List[Dict[str, Any]] = []

    if ROI_TOP_RATIO > 0:
        top_height = int(height * ROI_TOP_RATIO)
        top_height = max(0, min(height, top_height))
        if top_height > 0:
            candidates.append({"name": "top", "rect": (0, 0, width, top_height)})

    sorted_boxes = sorted(
        (box for box in line_boxes if box.get("height", 0) > 0),
        key=lambda item: item["height"],
        reverse=True,
    )

    for idx, box in enumerate(sorted_boxes):
        rect = box.get("rect")
        if not rect:
            continue
        x_min, y_min, x_max, y_max = rect
        rect_width = x_max - x_min
        rect_height = y_max - y_min
        if rect_width <= 0 or rect_height <= 0:
            continue
        pad_x = int(rect_width * (ROI_SCALE - 1) / 2)
        pad_y = int(rect_height * (ROI_SCALE - 1) / 2)
        new_x_min = max(0, x_min - pad_x)
        new_y_min = max(0, y_min - pad_y)
        new_x_max = min(width, x_max + pad_x)
        new_y_max = min(height, y_max + pad_y)
        candidates.append(
            {
                "name": f"line-{box.get('line_id', idx)}",
                "rect": (new_x_min, new_y_min, new_x_max, new_y_max),
            }
        )
        if len(candidates) >= ROI_MAX:
            break

    return candidates[:ROI_MAX]


def _run_roi_passes(
    ocr: PaddleOCR,
    image: np.ndarray,
    line_boxes: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rois = _generate_roi_candidates(image, line_boxes)
    results: List[Dict[str, Any]] = []

    height, width = image.shape[:2]
    for index, roi in enumerate(rois):
        x_min, y_min, x_max, y_max = roi["rect"]
        x_min = max(0, min(width, x_min))
        x_max = max(0, min(width, x_max))
        y_min = max(0, min(height, y_min))
        y_max = max(0, min(height, y_max))
        if x_max - x_min < 10 or y_max - y_min < 10:
            continue
        crop = image[y_min:y_max, x_min:x_max].copy()
        result = _recognize_pass(
            ocr,
            crop,
            pass_name=f"roi-{roi['name']}-{index}",
            bbox_offset=(x_min, y_min),
        )
        result["roi_rect"] = roi["rect"]
        results.append(result)

    return results


def _write_debug_overlay(image: np.ndarray, words: List[Dict[str, Any]], digest: str) -> None:
    if not DEBUG_OVERLAY:
        return
    if image.size == 0:
        return
    overlay = image.copy()
    for word in words:
        bbox = word.get("bbox")
        if not bbox or len(bbox) != 8:
            continue
        pts = np.array(
            [
                (bbox[0], bbox[1]),
                (bbox[2], bbox[3]),
                (bbox[4], bbox[5]),
                (bbox[6], bbox[7]),
            ],
            dtype=np.int32,
        ).reshape((-1, 1, 2))
        cv2.polylines(overlay, [pts], True, (0, 255, 0), 2)
        label = str(word.get("text", ""))[:16]
        cv2.putText(
            overlay,
            label,
            (pts[0][0][0], max(0, pts[0][0][1] - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 0),
            1,
            cv2.LINE_AA,
        )

    path = os.path.join(OVERLAY_DIR, f"{digest}.jpg")
    cv2.imwrite(path, overlay)


def run_ocr(ocr: PaddleOCR, img_bytes: bytes, digest: str) -> Dict[str, Any]:
    path = _cache_path(digest)
    if os.path.exists(path):
        cached = _load_cache(path)
        print(
            f"[OCR] Digest={digest[:8]}, words={len(cached['words'])}, "
            f"filtered={cached.get('filtered_count', 0)}, corrected={cached.get('corrected_count', 0)}, "
            f"roi={cached.get('roi_passes', 0)}, time={cached['elapsed_ms']}ms (cached)"
        )
        return cached

    image = _decode_image(img_bytes)
    processed_image, preprocess_meta = _preprocess_image(image)

    base_result = _recognize_pass(ocr, processed_image, pass_name="base")

    words = list(base_result["words"])
    filtered_count = base_result["filtered"]
    fallback_count = base_result["fallback"]
    corrected_count = base_result["corrected_count"]
    low_conf_samples = list(base_result["low_conf_samples"])
    brand_hits = list(base_result["brand_hits"])
    elapsed_ms = base_result["elapsed_ms"]

    roi_results: List[Dict[str, Any]] = []
    if ROI_ENABLED and not brand_hits:
        roi_results = _run_roi_passes(ocr, processed_image, base_result["line_boxes"])
        for result in roi_results:
            if result["words"]:
                line_offset = (
                    max((int(word.get("line_id", 0)) for word in words), default=-1) + 1
                )
                for roi_word in result["words"]:
                    roi_word["line_id"] = int(roi_word.get("line_id", 0)) + line_offset
                    words.append(roi_word)
            filtered_count += result["filtered"]
            fallback_count += result["fallback"]
            corrected_count += result["corrected_count"]
            elapsed_ms += result["elapsed_ms"]
            low_conf_samples.extend(result["low_conf_samples"])
            brand_hits.extend(result["brand_hits"])

    unique_brand_hits = sorted({hit for hit in brand_hits})
    text_lines, joined_text = _build_joined_text(words)

    payload = {
        "engine": "paddleocr",
        "text": joined_text,
        "lines": text_lines,
        "words": words,
        "orientation": {"angle": 0, "confidence": 1.0},
        "elapsed_ms": elapsed_ms,
        "digest": digest,
        "filtered_count": filtered_count,
        "fallback_count": fallback_count,
        "corrected_count": corrected_count,
        "cached": False,
        "low_confidence_samples": low_conf_samples[:5],
        "preprocess": dict(preprocess_meta, roi_passes=len(roi_results)),
        "brand_hits": unique_brand_hits,
        "passes": [
            {
                "name": base_result["pass"],
                "elapsed_ms": base_result["elapsed_ms"],
                "words": len(base_result["words"]),
                "brand_hits": base_result["brand_hits"],
            },
        ]
        + [
            {
                "name": roi_result["pass"],
                "elapsed_ms": roi_result["elapsed_ms"],
                "words": len(roi_result["words"]),
                "brand_hits": roi_result["brand_hits"],
                "roi_rect": roi_result.get("roi_rect"),
            }
            for roi_result in roi_results
        ],
    }

    _store_cache(path, payload)

    print(
        f"[OCR] Digest={digest[:8]}, words={len(words)}, filtered={filtered_count}, "
        f"fallback={fallback_count}, corrected={corrected_count}, roi={len(roi_results)}, "
        f"brand_hits={unique_brand_hits}, time={elapsed_ms}ms, "
        f"preprocess={preprocess_meta['preprocess_ms']}ms"
    )

    if low_conf_samples:
        preview = ", ".join(
            f"{txt[:18]}({conf:.2f})" for txt, conf in low_conf_samples[:5]
        )
        print(f"[OCR] low-confidence samples kept/filtered: {preview}")

    _write_debug_overlay(processed_image, words, digest)

    return payload
