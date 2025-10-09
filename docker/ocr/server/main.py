from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .ocr_text import init_ocr, run_ocr
from .utils import img_sha256

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
ocr = init_ocr()
ready = {"loaded": True}


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/readyz")
def readyz():
    return {"ready": ready["loaded"]}


@app.get("/version")
def version():
    return {"paddleocr": "2.7.0", "paddlepaddle": "2.6.1"}


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    data = await file.read()
    digest = img_sha256(data)
    result = run_ocr(ocr, data, digest)
    return result
