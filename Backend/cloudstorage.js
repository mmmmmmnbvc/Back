import { Storage } from "@google-cloud/storage";

const storage = new Storage();
const bucketName = "gnssstorage";

const bucket = storage.bucket(bucketName);

export async function getFiles() {
  const [files] = await bucket.getFiles();
  return files.map(file => file.name);
}

export async function getCSV(day, file) {

  const filePath = `${day}/${file}`;   //  เปลี่ยนชื่อ

  console.log("Loading:", filePath);

  const fileRef = bucket.file(filePath);

  const [data] = await fileRef.download();

  return data.toString();
}