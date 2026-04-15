import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = express.Router();


const storage = multer.diskStorage({
destination: (req, file, cb) => {
  const uploadPath = path.join(
    process.cwd(),
    "../Frontend/public"
  );

  cb(null, uploadPath);
},

  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

router.post("/upload", upload.single("file"), (req, res) => {
  const folder = req.body.folder || "";

  const targetDir = path.join(
    process.cwd(),
    "../Frontend/public",
    folder
  );

  fs.mkdirSync(targetDir, { recursive: true });

  const oldPath = req.file.path;
  const newPath = path.join(targetDir, req.file.originalname);

  fs.renameSync(oldPath, newPath);

  res.json({
    success: true,
    name: req.file.originalname
  });
});

export default router;