import express from "express";
import cors from "cors";
import { getFiles, getCSV } from "./cloudstorage.js";

const app = express();
app.use(cors());

app.get("/api/files", async (req, res) => {
  const files = await getFiles();
  res.json(files);
});

app.get("/api/:day/:file", async (req, res) => {
  try {
    const { day, file } = req.params;

    const data = await getCSV(day, file);  

    res.set("Content-Type", "text/csv");
    res.send(data);

  } catch (err) {
    console.error(err);
    res.status(404).send("File not found");
  }
});

app.listen(3001, () => {
  console.log("API running on http://localhost:3001");
});