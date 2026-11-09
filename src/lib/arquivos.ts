import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX = 10 * 1024 * 1024;

/** Guarda os comprovantes enviados no bucket privado e devolve os caminhos. */
export async function guardarComprovantes(arquivos: FormDataEntryValue[], pasta: string) {
  const files = arquivos.filter((f): f is File => f instanceof File && f.size > 0);
  const paths: string[] = [];
  for (const f of files) {
    if (!TIPOS.includes(f.type)) throw new Error(`“${f.name}” não é foto nem PDF.`);
    if (f.size > MAX) throw new Error(`“${f.name}” tem mais de 10 MB.`);
    const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1];
    const path = `${pasta}/${randomUUID()}.${ext}`;
    const { error } = await createServiceClient().storage.from("comprovantes").upload(path, f, { contentType: f.type });
    if (error) throw new Error("Falha ao enviar o comprovante: " + error.message);
    paths.push(path);
  }
  return paths;
}
