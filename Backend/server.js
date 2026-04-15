import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import uploadRouter from "./Upload.js";
import { exec } from 'child_process';   // ✅ เพิ่ม
const app = express();
app.use(cors());
const DAYS_PATH = path.join(process.cwd(), 'days');
app.use("/days", express.static(DAYS_PATH));
app.use("/api", uploadRouter);
// 🔥 path ไปยัง frontend/public
const FRONTEND_PUBLIC = path.join(process.cwd(), '/days');
const PYTHON_SCRIPT = path.join(process.cwd(), 'ETL.py'); // ✅ เพิ่ม

// ============================
// 📁 GET: list folders (ระดับบน)
// ============================
app.get('/api/folders', (req, res) => {
  const dirs = fs.readdirSync(FRONTEND_PUBLIC, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  res.json(dirs);
});

// ============================
// 📂 GET: อ่านไฟล์ในโฟลเดอร์
// ============================
app.get('/api/files', (req, res) => {
  const folder = req.query.folder; // เช่น 2568/204

  if (!folder) {
    return res.status(400).json({ error: 'folder is required' });
  }

  const targetDir = path.join(FRONTEND_PUBLIC, folder);

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'folder not found' });
  }

  const files = fs.readdirSync(targetDir)
    .filter(name => !name.startsWith('.'))
    .map(name => {
      const fullPath = path.join(targetDir, name);
      const stat = fs.statSync(fullPath);

      return {
        name,
        size: stat.size,
        type: path.extname(name),
        url: `/${folder}/${name}`, // ใช้เปิดไฟล์
      };
    });

  res.json(files);
});

// ============================
// 🗑️ DELETE: ลบไฟล์จริง
// ============================
app.delete('/api/files', (req, res) => {
  const { folder, name } = req.query;

  if (!folder || !name) {
    return res.status(400).json({ error: 'folder and name are required' });
  }

  const filePath = path.join(FRONTEND_PUBLIC, folder, name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'file not found' });
  }

  try {
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'delete failed' });
  }
});
// ============================
// 🔄 POST: convert .25o → CSV
// ============================
app.post('/api/convert', express.json(), (req, res) => {
  const { folder } = req.body;

  if (!folder) {
    return res.status(400).json({ error: 'folder is required' });
  }

  const targetDir = path.join(FRONTEND_PUBLIC, folder);

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'folder not found' });
  }

  console.log("📂 Converting folder:", targetDir);

  exec(`python "${PYTHON_SCRIPT}" --bulk "${targetDir}"`, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ ERROR:", err);
      return res.status(500).json({ error: 'convert failed' });
    }

    console.log("✅ RESULT:", stdout);

    res.json({
      success: true,
      message: "Convert success",
      output: stdout,
    });
  });
});

// ============================
// 📁 POST: create folder
// ============================
app.post('/api/create-folder', express.json(), (req, res) => {
  const { folder, name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const targetPath = path.join(FRONTEND_PUBLIC, folder || '', name);

  try {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    res.json({
      success: true,
      folder: name
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'create folder failed' });
  }
});

// ============================
// 🚀 Start Server
// ============================
app.listen(4000, () => {
  console.log('✅ Backend running at http://localhost:4000');
});
