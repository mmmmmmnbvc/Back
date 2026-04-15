from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 🔥 กัน path พัง
BASE_DIR = Path(__file__).resolve().parent
DATA_ROOT = BASE_DIR / "data"

# 🔥 แก้ CORS (สำคัญมาก)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  # หรือ ["*"] เพื่ออนุญาตทุก origin
    allow_methods=["GET", "POST", "OPTIONS"],  # หรือ ["*"] เพื่อทุก method
    allow_headers=["*"],
)
@app.get("/csv/{day}/{filename}")
def get_csv(day: str, filename: str):
    print("API HIT: - main.py:22", day, filename)  # 👈 เพิ่มอันนี้

    file_path = DATA_ROOT / day / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    return FileResponse(
        path=file_path,
        media_type="text/csv",
        filename=filename
    )
