type StorageFile = {
  kind: "doc" | "sheet" | "image" | "pdf" | "slide";
  sizeKb: number;
};

export function summarizeStorage(files: StorageFile[]) {
  let documentsKb = 0;
  let imagesKb = 0;
  let totalKb = 0;

  for (const file of files) {
    totalKb += file.sizeKb;
    if (file.kind === "image") {
      imagesKb += file.sizeKb;
    } else {
      documentsKb += file.sizeKb;
    }
  }

  return { documentsKb, imagesKb, totalKb };
}
