import express from 'express';
import cors from 'cors';//ให้ frontend คนละ port เรียกได้
import fs from 'fs';//จัดการไฟล์/โฟลเดอร์
import path from 'path';
import uploadRouter from "./Upload.js";
import { exec } from 'child_process';   //รัน Python script
const app = express();
app.use(cors());
const DAYS_PATH = path.join(process.cwd(), 'days');
app.use("/days", express.static(DAYS_PATH));
app.use("/api", uploadRouter);

// const FRONTEND_PUBLIC = path.join(process.cwd(), '/days');
const FRONTEND_PUBLIC = path.join(process.cwd(), 'days'); //path เก็บไฟล์จริง
const PYTHON_SCRIPT = path.join(process.cwd(), 'ETL.py'); // ไฟล์ Python ETL
const BASE_URL = "https://hiking-treated-elephant-lyrics.trycloudflare.com"; //Cloudflare tunnel

//  อ่าน folders
//เช็คว่ามีfolder ใน days ไหม
app.get('/api/folders', (req, res) => { //รับ query
  // const dirs = fs.readdirSync(FRONTEND_PUBLIC, { withFileTypes: true })
  if (!fs.existsSync(FRONTEND_PUBLIC)) {
  return res.json([]);
}

const dirs = fs.readdirSync(FRONTEND_PUBLIC, { withFileTypes: true })// อ่านทั้งหมดในFRONTEND_PUBLIC
    .filter(d => d.isDirectory()) //เลือกโฟลเดอร์ทั้งหมด
    .map(d => d.name); //เลือกแค่เฉพาะที่กำหนดพื่อให้ได้ List

  res.json(dirs);
});

// ============================
// 📂 GET: อ่านไฟล์ในโฟลเดอร์
// ============================
// app.get('/api/files', (req, res) => {
//   // ฝฃconst folder = req.query.folder; // เช่น 2568/204
//   const folder = req.query.folder || '';

//   // if (!folder) {
//   //   return res.status(400).json({ error: 'folder is required' });
//   // }

//   const targetDir = path.join(FRONTEND_PUBLIC, folder);

//   if (!fs.existsSync(targetDir)) {
//     return res.status(404).json({ error: 'folder not found' });
//   }

//   const files = fs.readdirSync(targetDir)
//     .filter(name => !name.startsWith('.'))
//     .map(name => {
//       const fullPath = path.join(targetDir, name);
//       const stat = fs.statSync(fullPath);

//       return {
//         name,
//         size: stat.size,
//         type: path.extname(name),
//         url: `/${folder}/${name}`, // ใช้เปิดไฟล์
//       };
//     });

//   res.json(files);
// });

//  อ่านไฟล์ในโฟลเดอร์
app.get('/api/files', (req, res) => {
  let folder = req.query.folder || '';


  folder = folder.replace(/^\//, '');  //  ตัด / หน้าออก

  const targetDir = path.join(FRONTEND_PUBLIC, folder);

  if (!fs.existsSync(targetDir)) {
    return res.json([]); //  ถ้าไม่มี folder → return []
  }

  const files = fs.readdirSync(targetDir)//อ่าน ชื่อไฟล์/โฟลเดอร์ทั้งหมด ข้างใน
    .filter(name => !name.startsWith('.')) //กรองไฟล์ที่ไม่ต้องการ
    .map(name => {
      const fullPath = path.join(targetDir, name); //สร้าง path เต็มของไฟล์
      const stat = fs.statSync(fullPath); //อ่านข้อมูลไฟล์

      return { //สร้าง object ส่งกลับ
        name,
        size: stat.size,
        type: path.extname(name),
        // url: `/${folder}/${name}`,
         url: `${BASE_URL}/days/${folder}/${name}`,
      };
    });

  res.json(files);
});

//   ลบไฟล์และโฟลเดอร์

app.delete('/api/files', (req, res) => { 
  const { folder, name } = req.query;

  if (!folder || !name) {//เช็คว่ามีชื่อโฟลเดอร์และไฟล์ไหม
    return res.status(400).json({ error: 'folder and name are required' });//ป้องกันไม่ให้โปรแกรมทำงานต่อถ้าข้อมูลไม่ครบ
  }

  const filePath = path.join(FRONTEND_PUBLIC, folder, name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'file not found' });
  }

  try {
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) { //ถ้าเป็นโฟลเดอร์
      fs.rmSync(filePath, { recursive: true, force: true }); //ลบโฟลเดอร์และเนื้อหาทั้งหมด
    } else {
      fs.unlinkSync(filePath);///ลบไฟล์
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'delete failed' });
  }
});

//  แปลง .25o to CSV

app.post('/api/convert', express.json(), (req, res) => {
  // const { folder } = req.body;
let { folder } = req.body;
folder = folder?.replace(/^\//, '') || '';
  if (!folder) {
    return res.status(400).json({ error: 'folder is required' });
  }

  const targetDir = path.join(FRONTEND_PUBLIC, folder);

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'folder not found' });
  }

  console.log("Converting folder:", targetDir);

  exec(`python "${PYTHON_SCRIPT}" --bulk "${targetDir}"`, (err, stdout, stderr) => { //รันคำสั่ง Python
    if (err) {
      console.error(" ERROR:", err);
      return res.status(500).json({ error: 'convert failed' });
    }

    console.log(" RESULT:", stdout);

    res.json({
      success: true,
      message: "Convert success",
      output: stdout,
    });
  });
});


//  สร้าง folder

app.post('/api/create-folder', express.json(), (req, res) => {
  const { folder, name } = req.body; //รับชื่อโฟลเดอร์ใหม่จาก frontend

  if (!name) {//เช็คว่าใส่ชื่อโฟลเดอร์ไหม
    return res.status(400).json({ error: 'name is required' });
  }

  const targetPath = path.join(FRONTEND_PUBLIC, folder || '', name);

  try {
    if (!fs.existsSync(targetPath)) { //เช็คว่าโฟลเดอร์มีอยู่แล้วไหม
      fs.mkdirSync(targetPath, { recursive: true });//สร้างโฟลเดอร์
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
//API ลิงก์ไปยังไฟล์ CSV
app.get("/api/csv", (req, res) => {
  const { folder, file } = req.query;

  if (!folder || !file) {
    return res.status(400).json({ error: "folder and file required" });
  }

  // const tunnelUrl = "https://notified-travelling-modules-lit.trycloudflare.com";
  

  const target = `${BASE_URL}/days/${folder}/${file}`;

  res.redirect(target);
});


//  Start Server

app.listen(4000, () => {
  console.log(' Backend running at http://localhost:4000');
});
